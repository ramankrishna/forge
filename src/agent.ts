import type {
  AgentConfig,
  ChatMessage,
  LLMRequest,
  LLMResponse,
  Provider,
  RunResult,
  Skill,
  ToolDef,
  ToolHandler,
  ToolResult,
  MemoryStore,
} from "./types.js";
import { OpenAIProvider } from "./provider.js";
import { loadSkill, loadSkillsFromDir, buildSkillSummary, buildSkillContext, collectTools } from "./skills.js";
import { MarkdownMemory } from "./memory.js";

const MAX_TOOL_ROUNDS = 10;

/**
 * The core agent runtime.
 *
 * Usage:
 * ```ts
 * import { Agent } from "@agents-eco/framework";
 *
 * const agent = new Agent({
 *   name: "my-agent",
 *   systemPrompt: "You are a helpful assistant.",
 *   provider: { name: "venice", apiKey: "...", baseUrl: "https://api.venice.ai/api/v1", defaultModel: "qwen3-4b" },
 *   skillsDir: "./skills",
 * });
 *
 * const result = await agent.chat("Hello!");
 * console.log(result.response);
 * ```
 */
export class Agent {
  readonly name: string;
  private provider: Provider;
  private model: string;
  private systemPrompt: string;
  private skills: Skill[] = [];
  private toolHandlers: Map<string, ToolHandler> = new Map();
  private memory: MemoryStore | null;
  private history: ChatMessage[] = [];
  private config: AgentConfig;
  private maxReasoningSteps: number;

  constructor(config: AgentConfig) {
    this.config = config;
    this.name = config.name;
    this.systemPrompt = config.systemPrompt;
    this.model = config.model ?? config.provider.defaultModel;
    this.maxReasoningSteps = config.maxReasoningSteps ?? 0;

    // Initialize provider
    this.provider = new OpenAIProvider(config.provider);

    // Initialize memory
    if (config.memory === false) {
      this.memory = null;
    } else if (config.memory) {
      this.memory = config.memory;
    } else {
      this.memory = new MarkdownMemory(config.memoryDir);
    }

    // Load skills
    this.loadSkills();

    // Register tool handlers
    if (config.toolHandlers) {
      for (const [name, handler] of Object.entries(config.toolHandlers)) {
        this.toolHandlers.set(name, handler);
      }
    }
  }

  /** Use a custom provider instance */
  useProvider(provider: Provider): this {
    this.provider = provider;
    return this;
  }

  /** Register a tool handler */
  tool(name: string, handler: ToolHandler): this {
    this.toolHandlers.set(name, handler);
    return this;
  }

  /** Add a skill at runtime */
  addSkill(skill: Skill): this {
    this.skills.push(skill);
    return this;
  }

  /** Load a skill from a file path */
  loadSkillFile(path: string): this {
    this.skills.push(loadSkill(path));
    return this;
  }

  /** Get conversation history */
  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  /** Clear conversation history */
  clearHistory(): void {
    this.history = [];
  }

  /** Get the memory store */
  getMemory(): MemoryStore | null {
    return this.memory;
  }

  /**
   * Send a message to the agent and get a response.
   * Handles tool calling loops, memory retrieval, and skill injection.
   */
  async chat(message: string): Promise<RunResult> {
    const startTime = Date.now();
    const allToolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }> = [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, llmCalls: 0 };

    // ── Build system prompt with skills + memory ────────
    let fullSystemPrompt = this.systemPrompt;

    // Inject skill summaries
    if (this.skills.length > 0) {
      fullSystemPrompt += buildSkillSummary(this.skills);
      // Inject full skill content for all loaded skills
      for (const skill of this.skills) {
        fullSystemPrompt += buildSkillContext(skill);
      }
    }

    // Inject memory context
    if (this.memory) {
      try {
        const memories = await this.memory.search(message, 5);
        if (memories.length > 0) {
          fullSystemPrompt += "\n\n<memory>\nRelevant memories from previous conversations:\n";
          for (const m of memories) {
            fullSystemPrompt += `- [${m.type}] ${m.content}\n`;
          }
          fullSystemPrompt += "</memory>\n";
        }
      } catch {
        // Memory retrieval failure is non-fatal
      }
    }

    // ── Build messages ──────────────────────────────────
    const messages: ChatMessage[] = [
      { role: "system", content: fullSystemPrompt },
      ...this.history,
      { role: "user", content: message },
    ];

    // Apply beforeRequest hook
    let processedMessages = messages;
    const tools = this.getAllTools();
    if (this.config.hooks?.beforeRequest) {
      processedMessages = await this.config.hooks.beforeRequest(messages, tools);
    }

    // ── LLM call loop (handles tool calls) ──────────────
    let response: LLMResponse;
    let rounds = 0;

    while (true) {
      const request: LLMRequest = {
        model: this.model,
        messages: processedMessages,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        tools: tools.length > 0 ? tools : undefined,
      };

      response = await this.provider.chat(request);
      totalUsage.promptTokens += response.usage.promptTokens;
      totalUsage.completionTokens += response.usage.completionTokens;
      totalUsage.totalTokens += response.usage.totalTokens;
      totalUsage.llmCalls++;

      // Apply afterResponse hook
      if (this.config.hooks?.afterResponse) {
        response = await this.config.hooks.afterResponse(response);
      }

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        break;
      }

      // Guard against infinite tool loops
      rounds++;
      if (rounds >= MAX_TOOL_ROUNDS) {
        break;
      }

      // Add assistant message with tool calls
      processedMessages.push({
        role: "assistant",
        content: response.content || "",
      });

      // Execute tool calls
      for (const tc of response.toolCalls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }

        // Apply beforeToolCall hook
        if (this.config.hooks?.beforeToolCall) {
          args = await this.config.hooks.beforeToolCall(tc.function.name, args);
        }

        let result: ToolResult;
        const handler = this.toolHandlers.get(tc.function.name);
        if (handler) {
          try {
            const output = await handler(args);
            result = { toolCallId: tc.id, content: output };
          } catch (err) {
            result = {
              toolCallId: tc.id,
              content: `Error: ${(err as Error).message}`,
              isError: true,
            };
          }
        } else {
          result = {
            toolCallId: tc.id,
            content: `Error: No handler registered for tool "${tc.function.name}"`,
            isError: true,
          };
        }

        // Apply afterToolCall hook
        if (this.config.hooks?.afterToolCall) {
          result = await this.config.hooks.afterToolCall(tc.function.name, result);
        }

        allToolCalls.push({ name: tc.function.name, args, result: result.content });

        processedMessages.push({
          role: "tool",
          content: result.content,
          toolCallId: tc.id,
        });
      }
    }

    const finalResponse = response!.content;

    // ── Update history ──────────────────────────────────
    this.history.push({ role: "user", content: message });
    this.history.push({ role: "assistant", content: finalResponse });

    // ── Store memory ────────────────────────────────────
    if (this.memory) {
      try {
        await this.memory.add({
          content: `User: ${message.slice(0, 500)}\nAssistant: ${finalResponse.slice(0, 500)}`,
          type: "conversation",
        });
      } catch {
        // Non-fatal
      }
    }

    return {
      response: finalResponse,
      messages: processedMessages,
      toolCalls: allToolCalls,
      usage: totalUsage,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Run a one-shot completion (no history, no memory).
   */
  async run(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt ?? this.systemPrompt },
      { role: "user", content: prompt },
    ];

    const response = await this.provider.chat({
      model: this.model,
      messages,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    return response.content;
  }

  // ── Private helpers ───────────────────────────────────

  private loadSkills(): void {
    // Load from explicit skill list
    if (this.config.skills) {
      for (const s of this.config.skills) {
        if (typeof s === "string") {
          try {
            this.skills.push(loadSkill(s));
          } catch (err) {
            console.warn(`[agent] Failed to load skill from ${s}: ${(err as Error).message}`);
          }
        } else {
          this.skills.push(s);
        }
      }
    }

    // Auto-discover from skillsDir
    if (this.config.skillsDir) {
      const discovered = loadSkillsFromDir(this.config.skillsDir);
      this.skills.push(...discovered);
    }
  }

  private getAllTools(): ToolDef[] {
    // Collect tools from skills
    const skillTools = collectTools(this.skills);

    // Collect tools from registered handlers that aren't already defined by skills
    const skillToolNames = new Set(skillTools.map((t) => t.function.name));
    const handlerTools: ToolDef[] = [];

    for (const [name] of this.toolHandlers) {
      if (!skillToolNames.has(name)) {
        // Auto-generate a minimal tool def for handlers without skill definitions
        handlerTools.push({
          type: "function",
          function: {
            name,
            description: `Execute the ${name} tool`,
            parameters: { type: "object", properties: {} },
          },
        });
      }
    }

    return [...skillTools, ...handlerTools];
  }
}

// ── Provider (LLM backend) ──────────────────────────────

export interface ProviderConfig {
  name: string;
  apiKey?: string;
  baseUrl: string;
  defaultModel: string;
  headers?: Record<string, string>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDef[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
}

// ── Tools / Skills ──────────────────────────────────────

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// ── Skills (markdown-driven) ────────────────────────────

export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  author?: string;
  tools?: SkillToolDef[];
  config?: Record<string, SkillConfigField>;
}

export interface SkillToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface SkillConfigField {
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface Skill {
  /** Parsed frontmatter */
  meta: SkillFrontmatter;
  /** Full markdown body (instructions for the LLM) */
  content: string;
  /** File path the skill was loaded from */
  source: string;
  /** Tool definitions derived from the skill */
  tools: ToolDef[];
}

// ── Memory ──────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  content: string;
  type: "conversation" | "observation" | "reflection" | "goal" | "skill";
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStore {
  /** Add a memory entry */
  add(entry: Omit<MemoryEntry, "id" | "timestamp">): Promise<MemoryEntry>;
  /** Search memories by query (semantic or keyword) */
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  /** Get all memories */
  list(limit?: number): Promise<MemoryEntry[]>;
  /** Clear all memories */
  clear(): Promise<void>;
}

// ── Agent ───────────────────────────────────────────────

export interface AgentConfig {
  /** Agent name */
  name: string;
  /** System prompt — the agent's personality and instructions */
  systemPrompt: string;
  /** LLM provider config */
  provider: ProviderConfig;
  /** Model override (defaults to provider.defaultModel) */
  model?: string;
  /** Skills to load (file paths or Skill objects) */
  skills?: (string | Skill)[];
  /** Skills directory to auto-discover */
  skillsDir?: string;
  /** Memory store (defaults to MarkdownMemory) */
  memory?: MemoryStore | false;
  /** Memory directory for file-based memory */
  memoryDir?: string;
  /** Max reasoning steps for multi-step thinking */
  maxReasoningSteps?: number;
  /** Temperature (0-2) */
  temperature?: number;
  /** Max tokens per response */
  maxTokens?: number;
  /** Tool executor functions keyed by tool name */
  toolHandlers?: Record<string, ToolHandler>;
  /** Middleware hooks */
  hooks?: AgentHooks;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string;

export interface AgentHooks {
  /** Called before sending messages to the LLM */
  beforeRequest?: (messages: ChatMessage[], tools: ToolDef[]) => ChatMessage[] | Promise<ChatMessage[]>;
  /** Called after receiving LLM response */
  afterResponse?: (response: LLMResponse) => LLMResponse | Promise<LLMResponse>;
  /** Called when a tool is about to be executed */
  beforeToolCall?: (name: string, args: Record<string, unknown>) => Record<string, unknown> | Promise<Record<string, unknown>>;
  /** Called after tool execution */
  afterToolCall?: (name: string, result: ToolResult) => ToolResult | Promise<ToolResult>;
  /** Called on error */
  onError?: (error: Error) => void;
}

// ── Run result ──────────────────────────────────────────

export interface RunResult {
  response: string;
  messages: ChatMessage[];
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: string }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    llmCalls: number;
  };
  duration: number;
}

// ── Provider interface ──────────────────────────────────

export interface Provider {
  name: string;
  chat(request: LLMRequest): Promise<LLMResponse>;
}

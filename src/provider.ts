import type {
  Provider,
  ProviderConfig,
  LLMRequest,
  LLMResponse,
  ChatMessage,
  ToolCall,
} from "./types.js";

/**
 * OpenAI-compatible provider.
 * Works with: OpenAI, Venice, Groq, Together, Ollama, or any OpenAI-compatible API.
 */
export class OpenAIProvider implements Provider {
  readonly name: string;
  private apiKey: string;
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.apiKey = config.apiKey ?? "";
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.headers = config.headers ?? {};
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const messages = request.messages.map((m) => {
      const msg: Record<string, unknown> = { role: m.role, content: m.content };
      if (m.name) msg.name = m.name;
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      return msg;
    });

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      if (request.toolChoice) {
        body.tool_choice = request.toolChoice;
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.headers,
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[${this.name}] LLM request failed (${res.status}): ${errText}`);
    }

    const data = await res.json() as any;
    const choice = data.choices?.[0];

    if (!choice) {
      throw new Error(`[${this.name}] No choices in response`);
    }

    const toolCalls: ToolCall[] = (choice.message?.tool_calls ?? []).map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content: choice.message?.content ?? "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      model: data.model ?? request.model,
      finishReason: choice.finish_reason ?? "stop",
    };
  }
}

// ── Pre-configured provider factories ───────────────────

/** Create a provider for Venice AI */
export function veniceProvider(apiKey: string): Provider {
  return new OpenAIProvider({
    name: "venice",
    apiKey,
    baseUrl: "https://api.venice.ai/api/v1",
    defaultModel: "qwen3-4b",
  });
}

/** Create a provider for OpenAI */
export function openaiProvider(apiKey: string): Provider {
  return new OpenAIProvider({
    name: "openai",
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  });
}

/** Create a provider for Groq */
export function groqProvider(apiKey: string): Provider {
  return new OpenAIProvider({
    name: "groq",
    apiKey,
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  });
}

/** Create a provider for a local Ollama instance */
export function ollamaProvider(model = "llama3.2", baseUrl = "http://localhost:11434"): Provider {
  return new OpenAIProvider({
    name: "ollama",
    baseUrl: `${baseUrl}/v1`,
    defaultModel: model,
  });
}

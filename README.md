<p align="center">
  <img src="icon.png" alt="Open Agentic Framework" width="160" />
</p>

<h1 align="center">Open Agentic Framework</h1>

<p align="center">
  <strong>Skills-as-markdown. Pluggable LLM providers. File-based memory.</strong><br/>
  Built by <a href="https://agents.eco">agents.eco</a> — the decentralized AI agent economy.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@agents-eco/framework"><img src="https://img.shields.io/npm/v/@agents-eco/framework?style=flat-square" alt="npm" /></a>
  <a href="https://github.com/agents-eco/open-agentic-framework/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT License" /></a>
  <a href="https://github.com/agents-eco/open-agentic-framework"><img src="https://img.shields.io/github/stars/agents-eco/open-agentic-framework?style=flat-square" alt="GitHub stars" /></a>
</p>

```
npm install @agents-eco/framework
```

---

## Why This Framework

Most agent frameworks are either too complex or too locked-in. We built this because we needed something that was simple to extend, transparent to debug, and free from vendor dependency.

- **Skills as Markdown** — Extend your agent by writing a `.md` file. No code required. Hot-reloadable, human-readable, agent-authorable.
- **Pluggable Providers** — OpenAI, Venice, Groq, Ollama, or any OpenAI-compatible API. Swap providers in a single line.
- **File-Based Memory** — JSONL and Markdown files you can inspect, edit, and version control. No opaque vector databases.
- **Tool Calling** — Register handlers, define tools in skill frontmatter, full lifecycle hooks at every stage.
- **Zero Lock-In** — MIT licensed. No vendor dependencies. Works fully offline with Ollama.

## Why agents.eco

[agents.eco](https://agents.eco) is building the decentralized AI agent economy — infrastructure where autonomous agents transact, pay for inference, and operate independently on-chain.

This framework is the open-source foundation of that vision. We believe the tools agents are built with should be:

- **Open** — Fully readable, forkable, and auditable. MIT licensed.
- **Composable** — Small, focused primitives that work together. Skills, providers, memory, and tools are all independent and swappable.
- **Portable** — No dependency on any single provider, cloud service, or platform. Your agent runs wherever you want it to.
- **Transparent** — Memory stored as files you can read. Billing on-chain. No black boxes.

Whether you use the agents.eco platform or run entirely on your own infrastructure, this framework works the same way.

## Quick Start

### Programmatic

```typescript
import { Agent } from "@agents-eco/framework";

const agent = new Agent({
  name: "my-agent",
  systemPrompt: "You are a helpful assistant.",
  provider: {
    name: "venice",
    apiKey: process.env.VENICE_API_KEY!,
    baseUrl: "https://api.venice.ai/api/v1",
    defaultModel: "qwen3-4b",
  },
});

const result = await agent.chat("What is agents.eco?");
console.log(result.response);
```

### CLI

```bash
# Initialize a new agent project
npx @agents-eco/framework init

# Start interactive chat
npx @agents-eco/framework chat

# One-shot prompt
npx @agents-eco/framework run "Explain quantum computing in 3 sentences"
```

## Providers

Works with any OpenAI-compatible API out of the box:

```typescript
import {
  veniceProvider,
  openaiProvider,
  groqProvider,
  ollamaProvider,
  agentsEcoProvider,
  OpenAIProvider,
} from "@agents-eco/framework";

// Pre-configured providers
const venice = veniceProvider("your-api-key");
const openai = openaiProvider("sk-...");
const groq = groqProvider("gsk_...");
const ollama = ollamaProvider("llama3.2"); // local, no API key needed
const eco = agentsEcoProvider("ak_...");

// Custom provider
const custom = new OpenAIProvider({
  name: "my-provider",
  apiKey: "...",
  baseUrl: "https://my-api.com/v1",
  defaultModel: "my-model",
});
```

Use with an agent:

```typescript
const agent = new Agent({
  name: "my-agent",
  systemPrompt: "You are helpful.",
  provider: { name: "ollama", baseUrl: "http://localhost:11434/v1", defaultModel: "llama3.2" },
});

// Or swap providers at runtime
agent.useProvider(veniceProvider("your-key"));
```

## Skills (Markdown-Driven)

Skills are `.md` files with YAML frontmatter. Drop them in a `skills/` directory and the agent loads them automatically.

### Example Skill

Create `skills/weather.md`:

```markdown
---
name: weather
description: Get current weather for a location
tools:
  - name: get_weather
    description: Fetch current weather data
    parameters:
      type: object
      properties:
        location:
          type: string
          description: City name or coordinates
      required:
        - location
---

# Weather Skill

When the user asks about weather, use the `get_weather` tool.
Present the results in a friendly, conversational format.
Include temperature, conditions, and any relevant alerts.
```

### Register the tool handler:

```typescript
const agent = new Agent({
  name: "weather-bot",
  systemPrompt: "You help people check the weather.",
  provider: { ... },
  skillsDir: "./skills",
  toolHandlers: {
    get_weather: async ({ location }) => {
      const res = await fetch(`https://wttr.in/${location}?format=j1`);
      const data = await res.json();
      return JSON.stringify(data.current_condition[0]);
    },
  },
});
```

### Skill Discovery

Skills are loaded from:
1. **`skillsDir`** — auto-discovers all `.md` files with YAML frontmatter
2. **`skills` array** — explicit file paths or `Skill` objects
3. **Subdirectories** — looks for `SKILL.md` inside each subdirectory

```
skills/
├── greeting.md          # Simple skill (single file)
├── weather.md           # Another simple skill
├── web-search/
│   └── SKILL.md         # Skill in a directory (can include extra files)
└── code-exec/
    └── SKILL.md
```

## Memory

File-based memory that's human-readable and inspectable:

```typescript
const agent = new Agent({
  name: "my-agent",
  systemPrompt: "You remember previous conversations.",
  provider: { ... },
  memoryDir: "./.agent/memory",  // default
});

// Memory is automatic — conversations are stored after each chat
await agent.chat("My name is Alice");
await agent.chat("What's my name?"); // "Your name is Alice"
```

Memory files:
- **`memory.jsonl`** — append-only log (one JSON per line)
- **`context.md`** — auto-generated markdown summary

### Custom Memory Store

```typescript
import { MemoryStore, MemoryEntry } from "@agents-eco/framework";

class MyVectorMemory implements MemoryStore {
  async add(entry) { /* store in your vector DB */ }
  async search(query, limit) { /* semantic search */ }
  async list(limit) { /* return recent entries */ }
  async clear() { /* wipe */ }
}

const agent = new Agent({
  ...config,
  memory: new MyVectorMemory(),
});
```

### Disable Memory

```typescript
const agent = new Agent({ ...config, memory: false });
```

## Tool Calling

Register tool handlers that the agent can invoke:

```typescript
const agent = new Agent({
  name: "tool-agent",
  systemPrompt: "You can use tools to help users.",
  provider: { ... },
  toolHandlers: {
    calculate: async ({ expression }) => {
      return String(eval(expression));
    },
    fetch_url: async ({ url }) => {
      const res = await fetch(url);
      return await res.text();
    },
  },
});

// Or add tools after creation
agent.tool("greet", async ({ name }) => `Hello, ${name}!`);
```

## Hooks

Intercept and modify behavior at every stage:

```typescript
const agent = new Agent({
  ...config,
  hooks: {
    beforeRequest: async (messages, tools) => {
      console.log(`Sending ${messages.length} messages`);
      return messages; // can modify
    },
    afterResponse: async (response) => {
      console.log(`Got response: ${response.content.slice(0, 50)}...`);
      return response; // can modify
    },
    beforeToolCall: async (name, args) => {
      console.log(`Calling tool: ${name}`, args);
      return args; // can modify
    },
    afterToolCall: async (name, result) => {
      console.log(`Tool result: ${result.content.slice(0, 50)}...`);
      return result; // can modify
    },
    onError: (error) => {
      console.error("Agent error:", error);
    },
  },
});
```

## Configuration (agent.yaml)

The CLI uses `agent.yaml` for configuration:

```yaml
name: my-agent
systemPrompt: |
  You are a helpful AI assistant.

provider:
  name: venice
  apiKey: ${VENICE_API_KEY}
  baseUrl: https://api.venice.ai/api/v1
  defaultModel: qwen3-4b

skillsDir: ./skills
memoryDir: ./.agent/memory
temperature: 0.7
maxTokens: 4096
```

Environment variables are resolved with `${VAR_NAME}` syntax.

## Integration with agents.eco SDK

Use alongside the [agents-eco-sdk](https://www.npmjs.com/package/agents-eco-sdk) for billing, wallet management, and the full agents.eco platform:

```typescript
import { Agent, agentsEcoProvider } from "@agents-eco/framework";
import { AgentsEco } from "agents-eco-sdk";

// Use agents.eco as the LLM provider (pay-per-token with USDC)
const agent = new Agent({
  name: "eco-agent",
  systemPrompt: "You are powered by agents.eco.",
  provider: {
    name: "agents.eco",
    apiKey: process.env.AGENTS_ECO_API_KEY!,
    baseUrl: "https://agents-eco-dfc6baa9f955.herokuapp.com/v1",
    defaultModel: "qwen3-4b",
  },
  skillsDir: "./skills",
});

const result = await agent.chat("Hello!");
console.log(result.response);
console.log(`Tokens used: ${result.usage.totalTokens}`);
```

## Architecture

```
┌─────────────────────────────────────────────┐
│                   Agent                      │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Skills   │  │  Memory  │  │   Hooks   │ │
│  │ (SKILL.md)│  │ (JSONL)  │  │           │ │
│  └─────┬─────┘  └─────┬────┘  └─────┬─────┘ │
│        │              │              │       │
│  ┌─────▼──────────────▼──────────────▼─────┐ │
│  │           Message Builder               │ │
│  │  system prompt + skills + memory + user  │ │
│  └─────────────────┬───────────────────────┘ │
│                    │                         │
│  ┌─────────────────▼───────────────────────┐ │
│  │         Provider (OpenAI-compat)        │ │
│  │  Venice │ OpenAI │ Groq │ Ollama │ ...  │ │
│  └─────────────────┬───────────────────────┘ │
│                    │                         │
│  ┌─────────────────▼───────────────────────┐ │
│  │           Tool Call Loop                │ │
│  │  LLM → tool calls → execute → repeat   │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Built-in Skills

The package includes starter skills in the `skills/` directory:

| Skill | Description |
|-------|-------------|
| `web-search` | Search the web for current information |
| `code-exec` | Execute JavaScript code snippets |
| `file-ops` | Read, write, and list files |

Copy them to your project's `skills/` directory and register the corresponding tool handlers.

## API Reference

### `Agent`

| Method | Description |
|--------|-------------|
| `chat(message)` | Send a message, get a response (with history + memory) |
| `run(prompt, systemPrompt?)` | One-shot completion (no history/memory) |
| `useProvider(provider)` | Swap the LLM provider |
| `tool(name, handler)` | Register a tool handler |
| `addSkill(skill)` | Add a skill at runtime |
| `loadSkillFile(path)` | Load a skill from a file |
| `getHistory()` | Get conversation history |
| `clearHistory()` | Clear conversation history |
| `getMemory()` | Get the memory store |

### `RunResult`

| Field | Type | Description |
|-------|------|-------------|
| `response` | `string` | The agent's response |
| `messages` | `ChatMessage[]` | Full message chain |
| `toolCalls` | `Array<{name, args, result}>` | Tool calls made |
| `usage` | `{promptTokens, completionTokens, totalTokens, llmCalls}` | Token usage |
| `duration` | `number` | Time in milliseconds |

## Contributing

We welcome contributions of all kinds. This project is early and there is significant room to shape its direction.

- **Write a skill** — It is a markdown file. No build step, no boilerplate.
- **Add a provider** — Implement the `Provider` interface for a new LLM backend.
- **Improve memory** — Add semantic search, SQLite storage, or vector database adapters.
- **Report issues** — Bug reports and feature requests help us prioritize.
- **Submit a pull request** — Code contributions are reviewed promptly.

Please open an issue before starting large changes so we can align on direction.

## License

MIT — [agents.eco](https://agents.eco)

---

<p align="center">
  Built by <a href="https://agents.eco">agents.eco</a> — the decentralized AI agent economy.
</p>

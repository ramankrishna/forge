#!/usr/bin/env node

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { parse as parseYaml } from "yaml";
import { Agent } from "./agent.js";
import type { AgentConfig, ProviderConfig } from "./types.js";

const AGENT_CONFIG_FILE = "agent.yaml";
const DEFAULT_SKILLS_DIR = "./skills";
const DEFAULT_MEMORY_DIR = "./.agent/memory";

function printHelp(): void {
  console.log(`
  @bottensor/forge — Open Agentic Framework

  Usage:
    bottensor-forge init              Create a new agent project
    bottensor-forge chat              Start interactive chat with your agent
    bottensor-forge run <prompt>      Run a one-shot prompt
    bottensor-forge skills            List loaded skills
    bottensor-forge help              Show this help

  Configuration:
    Create an agent.yaml in your project root:

    name: my-agent
    systemPrompt: You are a helpful assistant.
    provider:
      name: venice
      apiKey: \${VENICE_API_KEY}
      baseUrl: https://api.venice.ai/api/v1
      defaultModel: qwen3-4b
    skillsDir: ./skills
    memoryDir: ./.agent/memory
`);
}

function loadConfig(): AgentConfig | null {
  const configPath = resolve(AGENT_CONFIG_FILE);
  if (!existsSync(configPath)) {
    return null;
  }

  let raw = readFileSync(configPath, "utf-8");

  // Resolve environment variables: ${VAR_NAME}
  raw = raw.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] ?? "");

  const yaml = parseYaml(raw) as Record<string, unknown>;

  const provider = yaml.provider as Record<string, unknown>;
  if (!provider) {
    console.error("Error: agent.yaml must include a 'provider' section");
    process.exit(1);
  }

  return {
    name: (yaml.name as string) ?? "agent",
    systemPrompt: (yaml.systemPrompt as string) ?? "You are a helpful AI assistant.",
    provider: {
      name: (provider.name as string) ?? "default",
      apiKey: (provider.apiKey as string) ?? "",
      baseUrl: (provider.baseUrl as string) ?? "",
      defaultModel: (provider.defaultModel as string) ?? "gpt-4o-mini",
      headers: (provider.headers as Record<string, string>) ?? undefined,
    },
    model: yaml.model as string | undefined,
    skillsDir: (yaml.skillsDir as string) ?? DEFAULT_SKILLS_DIR,
    memoryDir: (yaml.memoryDir as string) ?? DEFAULT_MEMORY_DIR,
    temperature: yaml.temperature as number | undefined,
    maxTokens: yaml.maxTokens as number | undefined,
    maxReasoningSteps: yaml.maxReasoningSteps as number | undefined,
  };
}

async function cmdInit(): Promise<void> {
  const configPath = resolve(AGENT_CONFIG_FILE);
  if (existsSync(configPath)) {
    console.log("agent.yaml already exists.");
    return;
  }

  const template = `# Bottensor Forge Agent Configuration
name: my-agent
systemPrompt: |
  You are a helpful AI assistant.
  You are friendly, concise, and knowledgeable.

provider:
  name: venice
  apiKey: \${VENICE_API_KEY}
  baseUrl: https://api.venice.ai/api/v1
  defaultModel: qwen3-4b

# Uncomment to use OpenAI:
# provider:
#   name: openai
#   apiKey: \${OPENAI_API_KEY}
#   baseUrl: https://api.openai.com/v1
#   defaultModel: gpt-4o-mini

# Uncomment to use local Ollama:
# provider:
#   name: ollama
#   baseUrl: http://localhost:11434/v1
#   defaultModel: llama3.2

skillsDir: ./skills
memoryDir: ./.agent/memory
temperature: 0.7
maxTokens: 4096
`;

  writeFileSync(configPath, template);
  mkdirSync(resolve(DEFAULT_SKILLS_DIR), { recursive: true });

  // Create an example skill
  const exampleSkill = `---
name: greeting
description: Knows how to greet users in different languages
version: "1.0"
---

# Greeting Skill

When a user asks for a greeting or says hello, respond warmly.
You can greet in multiple languages:

- English: "Hello! How can I help you today?"
- Spanish: "¡Hola! ¿En qué puedo ayudarte?"
- Japanese: "こんにちは！何かお手伝いできますか？"
- French: "Bonjour ! Comment puis-je vous aider ?"

Always match the user's language if they greet you in a specific language.
`;

  writeFileSync(join(resolve(DEFAULT_SKILLS_DIR), "greeting.md"), exampleSkill);

  console.log(`
  ✓ Created agent.yaml
  ✓ Created skills/ directory with example skill
  
  Next steps:
    1. Set your API key: export VENICE_API_KEY=your-key
    2. Start chatting: bottensor-forge chat
    3. Add skills: create .md files in ./skills/
`);
}

async function cmdChat(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error("No agent.yaml found. Run 'bottensor-forge init' first.");
    process.exit(1);
  }

  const agent = new Agent(config);
  console.log(`\n  ${config.name} — powered by Bottensor Forge`);
  console.log(`  Provider: ${config.provider.name} (${config.provider.defaultModel})`);
  console.log(`  Type 'exit' to quit, 'clear' to reset history\n`);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question("you > ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        prompt();
        return;
      }
      if (trimmed === "exit" || trimmed === "quit") {
        console.log("\nGoodbye!");
        rl.close();
        process.exit(0);
      }
      if (trimmed === "clear") {
        agent.clearHistory();
        console.log("  (history cleared)\n");
        prompt();
        return;
      }
      if (trimmed === "skills") {
        const skills = (agent as any).skills as Array<{ meta: { name: string; description: string } }>;
        if (skills.length === 0) {
          console.log("  No skills loaded.\n");
        } else {
          console.log("  Loaded skills:");
          for (const s of skills) {
            console.log(`    - ${s.meta.name}: ${s.meta.description}`);
          }
          console.log();
        }
        prompt();
        return;
      }

      try {
        const result = await agent.chat(trimmed);
        console.log(`\n${config.name} > ${result.response}`);
        if (result.toolCalls.length > 0) {
          console.log(`  [${result.toolCalls.length} tool call(s), ${result.usage.llmCalls} LLM call(s), ${result.duration}ms]`);
        }
        console.log();
      } catch (err) {
        console.error(`  Error: ${(err as Error).message}\n`);
      }

      prompt();
    });
  };

  prompt();
}

async function cmdRun(promptText: string): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error("No agent.yaml found. Run 'bottensor-forge init' first.");
    process.exit(1);
  }

  const agent = new Agent(config);
  try {
    const result = await agent.chat(promptText);
    console.log(result.response);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

async function cmdSkills(): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error("No agent.yaml found. Run 'bottensor-forge init' first.");
    process.exit(1);
  }

  const agent = new Agent(config);
  const skills = (agent as any).skills as Array<{ meta: { name: string; description: string; version?: string }; source: string; tools: unknown[] }>;

  if (skills.length === 0) {
    console.log("No skills loaded. Add .md files to your skills directory.");
    return;
  }

  console.log(`\n  ${skills.length} skill(s) loaded:\n`);
  for (const s of skills) {
    console.log(`  ${s.meta.name} (v${s.meta.version ?? "1.0"})`);
    console.log(`    ${s.meta.description}`);
    console.log(`    Source: ${s.source}`);
    console.log(`    Tools: ${s.tools.length}`);
    console.log();
  }
}

// ── Main ────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "init":
    cmdInit();
    break;
  case "chat":
    cmdChat();
    break;
  case "run":
    if (!args[1]) {
      console.error("Usage: bottensor-forge run <prompt>");
      process.exit(1);
    }
    cmdRun(args.slice(1).join(" "));
    break;
  case "skills":
    cmdSkills();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}

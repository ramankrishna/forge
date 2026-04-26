/**
 * Basic chat example — minimal agent with Venice AI.
 *
 * Usage:
 *   export VENICE_API_KEY=your-key
 *   npx tsx examples/basic-chat.ts
 */
import { Agent } from "../src/index.js";

const agent = new Agent({
  name: "basic-bot",
  systemPrompt: "You are a friendly, concise AI assistant.",
  provider: {
    name: "venice",
    apiKey: process.env.VENICE_API_KEY ?? "",
    baseUrl: "https://api.venice.ai/api/v1",
    defaultModel: "qwen3-4b",
  },
  memory: false, // no persistence for this example
});

async function main() {
  console.log("Basic Chat Example\n");

  const result = await agent.chat("What are the top 3 benefits of open-source AI?");
  console.log(`Response: ${result.response}`);
  console.log(`\nTokens: ${result.usage.totalTokens} | Duration: ${result.duration}ms`);
}

main().catch(console.error);

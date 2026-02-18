/**
 * Multi-provider example — swap between providers at runtime.
 *
 * Usage:
 *   export VENICE_API_KEY=your-key
 *   npx tsx examples/multi-provider.ts
 */
import { Agent, veniceProvider, ollamaProvider } from "../src/index.js";

const agent = new Agent({
  name: "multi-bot",
  systemPrompt: "You are a helpful assistant. Respond in one sentence.",
  provider: {
    name: "venice",
    apiKey: process.env.VENICE_API_KEY ?? "",
    baseUrl: "https://api.venice.ai/api/v1",
    defaultModel: "qwen3-4b",
  },
  memory: false,
});

async function main() {
  console.log("Multi-Provider Example\n");

  // Use Venice
  console.log("--- Venice (qwen3-4b) ---");
  const r1 = await agent.chat("What is 2+2?");
  console.log(`Response: ${r1.response}\n`);

  // Swap to local Ollama (if running)
  try {
    console.log("--- Ollama (llama3.2) ---");
    agent.useProvider(ollamaProvider("llama3.2"));
    agent.clearHistory();
    const r2 = await agent.chat("What is 2+2?");
    console.log(`Response: ${r2.response}\n`);
  } catch (err) {
    console.log(`Ollama not available: ${(err as Error).message}\n`);
  }

  // Swap back to Venice
  console.log("--- Back to Venice ---");
  agent.useProvider(veniceProvider(process.env.VENICE_API_KEY ?? ""));
  agent.clearHistory();
  const r3 = await agent.chat("What is the capital of France?");
  console.log(`Response: ${r3.response}\n`);
}

main().catch(console.error);

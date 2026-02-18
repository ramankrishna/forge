/**
 * Tool-calling example — agent with custom tools.
 *
 * Usage:
 *   export VENICE_API_KEY=your-key
 *   npx tsx examples/with-tools.ts
 */
import { Agent, parseSkill } from "../src/index.js";

// Define a skill inline (normally you'd load from a .md file)
const mathSkill = parseSkill(`---
name: math
description: Perform mathematical calculations
tools:
  - name: calculate
    description: Evaluate a mathematical expression and return the result
    parameters:
      type: object
      properties:
        expression:
          type: string
          description: "A mathematical expression like '2 + 2' or 'Math.sqrt(144)'"
      required:
        - expression
---

# Math Skill

When the user asks you to calculate something, use the \`calculate\` tool.
Always show the expression you're evaluating and the result.
`, "inline");

const agent = new Agent({
  name: "math-bot",
  systemPrompt: "You are a helpful math assistant. Use the calculate tool for any math operations.",
  provider: {
    name: "venice",
    apiKey: process.env.VENICE_API_KEY ?? "",
    baseUrl: "https://api.venice.ai/api/v1",
    defaultModel: "qwen3-4b",
  },
  skills: [mathSkill],
  toolHandlers: {
    calculate: async ({ expression }) => {
      try {
        // Simple eval for demo — use a proper math parser in production
        const result = new Function(`return ${expression}`)();
        return String(result);
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
  },
  memory: false,
});

async function main() {
  console.log("Tool-Calling Example\n");

  const result = await agent.chat("What is the square root of 144 plus 25 squared?");
  console.log(`Response: ${result.response}`);
  console.log(`\nTool calls: ${result.toolCalls.length}`);
  for (const tc of result.toolCalls) {
    console.log(`  - ${tc.name}(${JSON.stringify(tc.args)}) → ${tc.result}`);
  }
  console.log(`\nTokens: ${result.usage.totalTokens} | LLM calls: ${result.usage.llmCalls} | Duration: ${result.duration}ms`);
}

main().catch(console.error);

---
name: code-exec
description: Execute JavaScript/TypeScript code snippets and return the output
version: "1.0"
tools:
  - name: execute_code
    description: Execute a JavaScript code snippet and return stdout/stderr output
    parameters:
      type: object
      properties:
        code:
          type: string
          description: JavaScript code to execute
        language:
          type: string
          description: "Language: 'javascript' or 'typescript' (default: javascript)"
          enum: [javascript, typescript]
      required:
        - code
---

# Code Execution Skill

When the user asks you to run code, calculate something, or needs a programmatic solution, use the `execute_code` tool.

## Guidelines

- Write clean, self-contained code snippets
- Use `console.log()` to output results — the tool captures stdout
- Handle errors gracefully with try/catch
- For math calculations, use JavaScript's built-in Math library
- For data processing, write the logic inline (no external imports)
- Always explain what the code does before running it
- If the code fails, analyze the error and try a corrected version

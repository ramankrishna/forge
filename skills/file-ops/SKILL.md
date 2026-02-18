---
name: file-ops
description: Read, write, and list files in the workspace
version: "1.0"
tools:
  - name: read_file
    description: Read the contents of a file
    parameters:
      type: object
      properties:
        path:
          type: string
          description: Path to the file to read
      required:
        - path
  - name: write_file
    description: Write content to a file (creates or overwrites)
    parameters:
      type: object
      properties:
        path:
          type: string
          description: Path to the file to write
        content:
          type: string
          description: Content to write to the file
      required:
        - path
        - content
  - name: list_files
    description: List files and directories at a given path
    parameters:
      type: object
      properties:
        path:
          type: string
          description: Directory path to list (default ".")
---

# File Operations Skill

When the user asks you to read, write, or manage files, use the file operation tools.

## Guidelines

- Always confirm before overwriting existing files
- Use relative paths from the workspace root
- When listing files, present them in a clean, organized format
- For large files, mention the file size and offer to show specific sections
- Never read or write files outside the workspace without explicit permission

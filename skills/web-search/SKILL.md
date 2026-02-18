---
name: web-search
description: Search the web for current information using a search query
version: "1.0"
tools:
  - name: web_search
    description: Search the web for current information. Returns relevant results.
    parameters:
      type: object
      properties:
        query:
          type: string
          description: The search query
        limit:
          type: number
          description: Max number of results (default 5)
      required:
        - query
---

# Web Search Skill

When the user asks about current events, recent information, or anything that requires up-to-date knowledge, use the `web_search` tool.

## Guidelines

- Formulate clear, specific search queries
- Summarize results concisely — don't just dump raw search results
- If the first search doesn't find what you need, try rephrasing the query
- Always cite your sources when presenting information from search results
- If results are ambiguous, let the user know and offer to refine the search

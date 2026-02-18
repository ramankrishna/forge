import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { MemoryStore, MemoryEntry } from "./types.js";

/**
 * File-based memory store using JSONL (one JSON object per line).
 * Human-readable, inspectable, and portable — inspired by OpenClaw's flat-file approach.
 *
 * Files:
 *   - memory.jsonl  — append-only log of all memory entries
 *   - context.md    — auto-generated markdown summary for human reading
 */
export class MarkdownMemory implements MemoryStore {
  private dir: string;
  private jsonlPath: string;
  private contextPath: string;
  private entries: MemoryEntry[] = [];
  private loaded = false;

  constructor(dir?: string) {
    this.dir = resolve(dir ?? "./.agent/memory");
    this.jsonlPath = join(this.dir, "memory.jsonl");
    this.contextPath = join(this.dir, "context.md");
  }

  private ensureDir(): void {
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;

    if (!existsSync(this.jsonlPath)) {
      this.entries = [];
      return;
    }

    const raw = readFileSync(this.jsonlPath, "utf-8");
    this.entries = raw
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line) as MemoryEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is MemoryEntry => e !== null);
  }

  private appendLine(entry: MemoryEntry): void {
    this.ensureDir();
    const line = JSON.stringify(entry) + "\n";
    writeFileSync(this.jsonlPath, line, { flag: "a" });
  }

  private updateContextMd(): void {
    this.ensureDir();
    const lines = [
      "# Agent Memory",
      "",
      `> Auto-generated. ${this.entries.length} entries. Last updated: ${new Date().toISOString()}`,
      "",
    ];

    // Group by type
    const grouped = new Map<string, MemoryEntry[]>();
    for (const e of this.entries) {
      const arr = grouped.get(e.type) ?? [];
      arr.push(e);
      grouped.set(e.type, arr);
    }

    for (const [type, entries] of grouped) {
      lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}s`);
      lines.push("");
      for (const e of entries.slice(-20)) {
        const date = new Date(e.timestamp).toLocaleDateString();
        lines.push(`- [${date}] ${e.content.slice(0, 200)}`);
      }
      lines.push("");
    }

    writeFileSync(this.contextPath, lines.join("\n"));
  }

  async add(entry: Omit<MemoryEntry, "id" | "timestamp">): Promise<MemoryEntry> {
    this.load();

    const full: MemoryEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.entries.push(full);
    this.appendLine(full);
    this.updateContextMd();

    return full;
  }

  async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    this.load();

    // Simple keyword search — score by number of matching words
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return this.entries.slice(-limit);

    const scored = this.entries.map((e) => {
      const text = e.content.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (text.includes(word)) score++;
      }
      return { entry: e, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  async list(limit = 50): Promise<MemoryEntry[]> {
    this.load();
    return this.entries.slice(-limit);
  }

  async clear(): Promise<void> {
    this.entries = [];
    this.loaded = true;
    this.ensureDir();
    writeFileSync(this.jsonlPath, "");
    this.updateContextMd();
  }
}

/**
 * In-memory store (no persistence). Useful for testing or ephemeral agents.
 */
export class InMemoryStore implements MemoryStore {
  private entries: MemoryEntry[] = [];

  async add(entry: Omit<MemoryEntry, "id" | "timestamp">): Promise<MemoryEntry> {
    const full: MemoryEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    this.entries.push(full);
    return full;
  }

  async search(query: string, limit = 5): Promise<MemoryEntry[]> {
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (queryWords.length === 0) return this.entries.slice(-limit);

    const scored = this.entries.map((e) => {
      const text = e.content.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (text.includes(word)) score++;
      }
      return { entry: e, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  async list(limit = 50): Promise<MemoryEntry[]> {
    return this.entries.slice(-limit);
  }

  async clear(): Promise<void> {
    this.entries = [];
  }
}

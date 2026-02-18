import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Skill, SkillFrontmatter, ToolDef, SkillToolDef } from "./types.js";

/**
 * Parse a SKILL.md file into a Skill object.
 *
 * Format:
 * ```
 * ---
 * name: my-skill
 * description: Does something useful
 * tools:
 *   - name: do_thing
 *     description: Does the thing
 *     parameters:
 *       type: object
 *       properties:
 *         input:
 *           type: string
 *           description: The input
 *       required: [input]
 * ---
 *
 * # My Skill
 *
 * Instructions for the LLM on how to use this skill...
 * ```
 */
export function parseSkill(raw: string, source: string): Skill {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error(`Invalid skill format in ${source}: missing YAML frontmatter (---)`);
  }

  const frontmatter = parseYaml(fmMatch[1]) as SkillFrontmatter;
  const content = fmMatch[2].trim();

  if (!frontmatter.name) {
    throw new Error(`Skill in ${source} is missing required 'name' field`);
  }
  if (!frontmatter.description) {
    throw new Error(`Skill in ${source} is missing required 'description' field`);
  }

  const tools: ToolDef[] = (frontmatter.tools ?? []).map((t: SkillToolDef) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters ?? { type: "object", properties: {} },
    },
  }));

  return {
    meta: frontmatter,
    content,
    source,
    tools,
  };
}

/**
 * Load a single skill from a file path.
 * Accepts either a SKILL.md file or a directory containing SKILL.md.
 */
export function loadSkill(path: string): Skill {
  const resolved = resolve(path);

  let filePath: string;
  if (statSync(resolved).isDirectory()) {
    filePath = join(resolved, "SKILL.md");
    if (!existsSync(filePath)) {
      throw new Error(`No SKILL.md found in directory: ${resolved}`);
    }
  } else {
    filePath = resolved;
  }

  const raw = readFileSync(filePath, "utf-8");
  return parseSkill(raw, filePath);
}

/**
 * Discover and load all skills from a directory.
 * Looks for:
 *   - *.md files with YAML frontmatter in the directory
 *   - Subdirectories containing SKILL.md
 */
export function loadSkillsFromDir(dir: string): Skill[] {
  const resolved = resolve(dir);
  if (!existsSync(resolved)) return [];

  const skills: Skill[] = [];
  const entries = readdirSync(resolved, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(resolved, entry.name);

    if (entry.isDirectory()) {
      // Look for SKILL.md inside subdirectory
      const skillFile = join(fullPath, "SKILL.md");
      if (existsSync(skillFile)) {
        try {
          skills.push(loadSkill(skillFile));
        } catch (err) {
          console.warn(`[skills] Failed to load ${skillFile}: ${(err as Error).message}`);
        }
      }
    } else if (entry.name.endsWith(".md") && entry.name !== "README.md") {
      // Try to parse as a skill
      try {
        const raw = readFileSync(fullPath, "utf-8");
        if (raw.startsWith("---")) {
          skills.push(parseSkill(raw, fullPath));
        }
      } catch {
        // Not a valid skill file, skip
      }
    }
  }

  return skills;
}

/**
 * Build the skill context string for injection into the system prompt.
 * Uses progressive disclosure: only names + descriptions by default.
 */
export function buildSkillSummary(skills: Skill[]): string {
  if (skills.length === 0) return "";

  const lines = skills.map(
    (s) => `- **${s.meta.name}**: ${s.meta.description}`
  );

  return `\nYou have the following skills available:\n${lines.join("\n")}\n`;
}

/**
 * Build the full skill context for a specific skill (injected when activated).
 */
export function buildSkillContext(skill: Skill): string {
  return `\n<skill name="${skill.meta.name}">\n${skill.content}\n</skill>\n`;
}

/**
 * Collect all tool definitions from loaded skills.
 */
export function collectTools(skills: Skill[]): ToolDef[] {
  return skills.flatMap((s) => s.tools);
}

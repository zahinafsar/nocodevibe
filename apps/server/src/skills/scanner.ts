import { readdir, readFile, stat, mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const GLOBAL_SKILLS_DIR = join(homedir(), ".coodeen", "skills");

export interface SkillInfo {
  name: string;
  description: string;
  location: string; // absolute path to SKILL.md
  content: string; // markdown body (instructions)
  enabled: boolean;
}

/**
 * Parse a SKILL.md file: YAML frontmatter (name, description) + markdown body.
 */
function parseSkillMd(raw: string): { name: string; description: string; content: string } | null {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;
  const frontmatter = match[1];
  const content = match[2].trim();

  let name = "";
  let description = "";
  for (const line of frontmatter.split("\n")) {
    const kv = line.match(/^(\w+)\s*:\s*(.+)$/);
    if (!kv) continue;
    if (kv[1] === "name") name = kv[2].trim().replace(/^["']|["']$/g, "");
    if (kv[1] === "description") description = kv[2].trim().replace(/^["']|["']$/g, "");
  }

  if (!name) return null;
  return { name, description, content };
}

/**
 * Scan for SKILL.md files in a directory tree (up to 3 levels deep).
 */
async function scanDir(root: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(root, entry.name, "SKILL.md");
      try {
        const raw = await readFile(skillMdPath, "utf-8");
        const parsed = parseSkillMd(raw);
        if (parsed) {
          skills.push({
            name: parsed.name,
            description: parsed.description,
            location: skillMdPath,
            content: parsed.content,
            enabled: true,
          });
        }
      } catch {
        // No SKILL.md in this subdirectory — skip
      }
    }
  } catch {
    // Directory doesn't exist — skip
  }
  return skills;
}

/**
 * Discover all skills.
 * Scans: ~/.coodeen/skills/
 */
export async function discoverSkills(): Promise<SkillInfo[]> {
  const all: SkillInfo[] = [];
  const found = await scanDir(GLOBAL_SKILLS_DIR);
  for (const skill of found) {
    const idx = all.findIndex((s) => s.name === skill.name);
    if (idx >= 0) all[idx] = skill;
    else all.push(skill);
  }
  return all;
}

/**
 * Read a single skill by name.
 */
export async function getSkill(name: string): Promise<SkillInfo | null> {
  const skills = await discoverSkills();
  return skills.find((s) => s.name === name) ?? null;
}

/**
 * Create a new skill.
 */
export async function createSkill(
  name: string,
  description: string,
  content: string,
): Promise<SkillInfo> {
  const dir = join(GLOBAL_SKILLS_DIR, name);
  await mkdir(dir, { recursive: true });
  const skillMd = `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}\n`;
  const location = join(dir, "SKILL.md");
  await writeFile(location, skillMd, "utf-8");
  return { name, description, location, content, enabled: true };
}

/**
 * Create a skill by writing raw SKILL.md content directly.
 */
export async function createSkillRaw(
  slug: string,
  raw: string,
): Promise<void> {
  const dir = join(GLOBAL_SKILLS_DIR, slug);
  await mkdir(dir, { recursive: true });
  const location = join(dir, "SKILL.md");
  await writeFile(location, raw, "utf-8");
}

/**
 * Delete a skill.
 */
export async function deleteSkill(name: string): Promise<boolean> {
  const dir = join(GLOBAL_SKILLS_DIR, name);
  try {
    await stat(dir);
    await rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

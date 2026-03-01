import { tool } from "ai";
import { z } from "zod/v4";
import { discoverSkills, getSkill } from "../skills/scanner.js";

/**
 * Creates the `skill` tool — lets the LLM load specialized skills at runtime.
 * The tool description lists available skills so the LLM knows what to invoke.
 */
export function createSkillTool() {
  return tool({
    description: [
      "Load a specialized skill that provides domain-specific instructions and workflows.",
      "When you recognize that a task matches one of the available skills, use this tool to load the full skill instructions.",
      "The skill will inject detailed instructions, workflows, and references into the conversation context.",
    ].join("\n"),
    inputSchema: z.object({
      name: z.string().describe("The name of the skill to load"),
    }),
    execute: async ({ name }) => {
      const skill = await getSkill(name);
      if (!skill) {
        const all = await discoverSkills();
        const available = all.map((s) => s.name).join(", ");
        return `Skill "${name}" not found. Available skills: ${available || "none"}`;
      }

      return [
        `<skill_content name="${skill.name}">`,
        `# Skill: ${skill.name}`,
        "",
        skill.content,
        "",
        `</skill_content>`,
      ].join("\n");
    },
  });
}

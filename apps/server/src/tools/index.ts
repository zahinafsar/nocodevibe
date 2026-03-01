import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";
import { createEditTool } from "./edit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";
import { createWebFetchTool } from "./webfetch.js";
import { createWebSearchTool } from "./websearch.js";
import { createCodeSearchTool } from "./codesearch.js";
import { createImageFetchTool } from "./imagefetch.js";
import { createPlanWriteTool, createPlanExitTool } from "./plan.js";
import { createQuestionTool } from "./question.js";
import { createSkillTool } from "./skill.js";

/**
 * Create all tools scoped to a specific project directory.
 * - Agent mode: full access (read + write + edit + skill)
 * - Plan mode: read-only + plan_write (plan file only) + plan_exit + skill
 */
export function createTools(
  projectDir: string,
  mode: "agent" | "plan" = "agent",
  planPath?: string,
  supportsVision = true,
) {
  const base = {
    read: createReadTool(projectDir),
    glob: createGlobTool(projectDir),
    grep: createGrepTool(projectDir),
    webfetch: createWebFetchTool(),
    websearch: createWebSearchTool(),
    codesearch: createCodeSearchTool(),
    imagefetch: createImageFetchTool(supportsVision),
    skill: createSkillTool(),
  };

  if (mode === "plan" && planPath) {
    return {
      ...base,
      question: createQuestionTool(),
      plan_write: createPlanWriteTool(planPath),
      plan_exit: createPlanExitTool(planPath),
    };
  }

  return {
    ...base,
    write: createWriteTool(projectDir),
    edit: createEditTool(projectDir),
  };
}

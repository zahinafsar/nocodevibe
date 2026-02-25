import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";
import { createEditTool } from "./edit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";

/**
 * Create all tools scoped to a specific project directory.
 * Relative paths in tool calls resolve against this directory.
 */
export function createTools(projectDir: string) {
  return {
    read: createReadTool(projectDir),
    write: createWriteTool(projectDir),
    edit: createEditTool(projectDir),
    glob: createGlobTool(projectDir),
    grep: createGrepTool(projectDir),
  } as const;
}

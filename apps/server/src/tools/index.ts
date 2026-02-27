import { createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";
import { createEditTool } from "./edit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";
import { createWebFetchTool } from "./webfetch.js";
import { createWebSearchTool } from "./websearch.js";
import { createCodeSearchTool } from "./codesearch.js";

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
    webfetch: createWebFetchTool(),
    websearch: createWebSearchTool(),
    codesearch: createCodeSearchTool(),
  } as const;
}

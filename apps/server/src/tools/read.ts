import { tool } from "ai";
import { z } from "zod/v4";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

export const createReadTool = (projectDir: string) =>
  tool({
    description:
      "Read a file and return its content with line numbers. " +
      "Accepts absolute paths or paths relative to the project directory.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute or project-relative path to the file to read"),
      offset: z
        .number()
        .optional()
        .describe("1-based line number to start reading from (default: 1)"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of lines to return (default: all)"),
    }),
    execute: async ({ file_path, offset, limit }) => {
      const resolved = resolve(projectDir, file_path);

      const raw = await readFile(resolved, "utf-8");
      let lines = raw.split("\n");

      const start = (offset ?? 1) - 1;
      if (start > 0) lines = lines.slice(start);
      if (limit !== undefined) lines = lines.slice(0, limit);

      const numbered = lines.map((line, i) => `${start + i + 1}\t${line}`).join("\n");
      return numbered;
    },
  });

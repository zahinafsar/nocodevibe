import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, dirname } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";

export const createWriteTool = (projectDir: string) =>
  tool({
    description:
      "Write content to a file. Creates parent directories if they don't exist. " +
      "Overwrites the file if it already exists.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute or project-relative path to write to"),
      content: z.string().describe("The full content to write to the file"),
    }),
    execute: async ({ file_path, content }) => {
      const resolved = resolve(projectDir, file_path);

      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, "utf-8");

      return `Wrote ${content.split("\n").length} lines to ${file_path}`;
    },
  });

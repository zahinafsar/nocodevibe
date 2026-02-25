import { tool } from "ai";
import { z } from "zod/v4";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";

export const createEditTool = (projectDir: string) =>
  tool({
    description:
      "Perform an exact string replacement in a file. " +
      "The old_string must appear exactly once in the file. " +
      "Fails if old_string is not found or appears more than once.",
    inputSchema: z.object({
      file_path: z.string().describe("Absolute or project-relative path to the file to edit"),
      old_string: z.string().describe("The exact text to find (must be unique in the file)"),
      new_string: z.string().describe("The replacement text"),
    }),
    execute: async ({ file_path, old_string, new_string }) => {
      const resolved = resolve(projectDir, file_path);

      const content = await readFile(resolved, "utf-8");

      const occurrences = content.split(old_string).length - 1;

      if (occurrences === 0) {
        throw new Error(
          `old_string not found in ${file_path}. Make sure it matches the file content exactly, including whitespace and indentation.`,
        );
      }

      if (occurrences > 1) {
        throw new Error(
          `old_string found ${occurrences} times in ${file_path}. It must be unique. Provide more surrounding context to make it unique.`,
        );
      }

      const updated = content.replace(old_string, new_string);
      await writeFile(resolved, updated, "utf-8");

      return `Edited ${file_path}: replaced 1 occurrence`;
    },
  });

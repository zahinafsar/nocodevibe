import { tool } from "ai";
import { z } from "zod/v4";
import fg from "fast-glob";
import { resolve, relative } from "node:path";

export const createGlobTool = (projectDir: string) =>
  tool({
    description:
      "Find files matching a glob pattern relative to the project directory. " +
      'Supports patterns like "**/*.ts", "src/**/*.tsx", etc.',
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern to match files (e.g. "**/*.ts", "src/**/*.tsx")'),
    }),
    execute: async ({ pattern }) => {
      const absProjectDir = resolve(projectDir);

      const matches = await fg(pattern, {
        cwd: absProjectDir,
        dot: false,
        onlyFiles: true,
        ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"],
      });

      const relativePaths = matches.map((m) => relative(absProjectDir, resolve(absProjectDir, m)));

      return relativePaths.length > 0
        ? relativePaths.sort().join("\n")
        : "No files matched the pattern.";
    },
  });

import { tool } from "ai";
import { z } from "zod/v4";
import { resolve, relative } from "node:path";
import fg from "fast-glob";
import { readFile, stat as fsStat } from "node:fs/promises";

interface GrepMatch {
  file: string;
  line: number;
  content: string;
}

export const createGrepTool = (projectDir: string) =>
  tool({
    description:
      "Search file contents for a regex pattern. " +
      "Returns matching lines with file path and line number. " +
      "If path is provided, searches only that file or directory.",
    inputSchema: z.object({
      pattern: z.string().describe("Regular expression pattern to search for"),
      path: z
        .string()
        .optional()
        .describe("File or directory to search in (default: entire project)"),
    }),
    execute: async ({ pattern, path }) => {
      const absProjectDir = resolve(projectDir);
      const searchRoot = path ? resolve(absProjectDir, path) : absProjectDir;

      let regex: RegExp;
      try {
        regex = new RegExp(pattern);
      } catch {
        throw new Error(`Invalid regex pattern: ${pattern}`);
      }

      let isFile = false;
      try {
        const s = await fsStat(searchRoot);
        isFile = s.isFile();
      } catch {
        // Path doesn't exist — treat as directory and let glob handle it
      }

      let files: string[];

      if (isFile) {
        files = [searchRoot];
      } else {
        files = await fg("**/*", {
          cwd: searchRoot,
          dot: false,
          onlyFiles: true,
          ignore: [
            "**/node_modules/**",
            "**/.git/**",
            "**/dist/**",
            "**/build/**",
            "**/*.png",
            "**/*.jpg",
            "**/*.gif",
            "**/*.ico",
            "**/*.woff",
            "**/*.woff2",
            "**/*.ttf",
            "**/*.eot",
            "**/*.mp4",
            "**/*.webm",
            "**/*.zip",
            "**/*.tar",
            "**/*.gz",
          ],
        });
        files = files.map((f) => resolve(searchRoot, f));
      }

      const matches: GrepMatch[] = [];
      const MAX_MATCHES = 100;

      for (const filePath of files) {
        if (matches.length >= MAX_MATCHES) break;
        try {
          const content = await readFile(filePath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              matches.push({
                file: relative(absProjectDir, filePath),
                line: i + 1,
                content: lines[i].trim(),
              });
              if (matches.length >= MAX_MATCHES) break;
            }
          }
        } catch {
          // Skip binary/unreadable files
        }
      }

      if (matches.length === 0) {
        return "No matches found.";
      }

      return matches
        .map((m) => `${m.file}:${m.line}: ${m.content}`)
        .join("\n");
    },
  });

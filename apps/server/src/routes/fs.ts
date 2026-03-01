import { Hono } from "hono";
import { readdir, readFile, writeFile, mkdir, stat, rm } from "node:fs/promises";
import { resolve, dirname, extname, join } from "node:path";
import { homedir } from "node:os";

const fs = new Hono();

const HIDDEN = new Set([
  "node_modules",
  ".git",
  ".next",
  ".cache",
  ".Trash",
  "__pycache__",
  ".tox",
  ".venv",
  "dist",
  ".turbo",
  ".DS_Store",
]);

/** Extension → highlight.js language */
const EXT_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".scss": "scss",
  ".html": "html",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "bash",
  ".sql": "sql",
  ".graphql": "graphql",
  ".gql": "graphql",
  ".toml": "toml",
  ".ini": "ini",
  ".env": "plaintext",
  ".txt": "plaintext",
  ".svg": "xml",
  ".dockerfile": "dockerfile",
  ".rb": "ruby",
  ".php": "php",
  ".swift": "swift",
  ".kt": "kotlin",
  ".dart": "dart",
  ".lua": "lua",
  ".r": "r",
  ".vue": "html",
  ".svelte": "html",
};

const BINARY_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".avif",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".exe", ".dll", ".so", ".dylib",
  ".sqlite", ".db",
]);

function isBinary(name: string): boolean {
  return BINARY_EXTS.has(extname(name).toLowerCase());
}

function detectLanguage(name: string): string {
  // Handle special filenames
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  if (lower === "makefile") return "makefile";
  if (lower === ".gitignore" || lower === ".dockerignore") return "plaintext";
  return EXT_LANG[extname(lower)] || "plaintext";
}

/** GET /api/fs/dirs?path=/some/dir — list subdirectories */
fs.get("/dirs", async (c) => {
  const raw = c.req.query("path") || homedir();
  const current = resolve(raw);
  const parent = dirname(current) !== current ? dirname(current) : null;

  try {
    const entries = await readdir(current, { withFileTypes: true });
    const dirs = entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          !HIDDEN.has(e.name),
      )
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return c.json({ current, parent, dirs });
  } catch {
    return c.json(
      { error: `Cannot read directory: ${current}` },
      400,
    );
  }
});

/** GET /api/fs/tree?path=<dir> — list files + dirs in a directory */
fs.get("/tree", async (c) => {
  const raw = c.req.query("path");
  if (!raw) return c.json({ error: "path query parameter required" }, 400);
  const dirPath = resolve(raw);

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const result: Array<{ name: string; type: "file" | "dir" }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".env") continue;
      if (HIDDEN.has(entry.name)) continue;

      if (entry.isDirectory()) {
        result.push({ name: entry.name, type: "dir" });
      } else if (entry.isFile()) {
        result.push({ name: entry.name, type: "file" });
      }
    }

    // Sort: dirs first, then files, both alphabetical
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    return c.json({ entries: result });
  } catch {
    return c.json({ error: `Cannot read directory: ${dirPath}` }, 400);
  }
});

/** GET /api/fs/file?path=<filepath> — read file content */
fs.get("/file", async (c) => {
  const raw = c.req.query("path");
  if (!raw) return c.json({ error: "path query parameter required" }, 400);
  const filePath = resolve(raw);

  try {
    const s = await stat(filePath);
    if (!s.isFile()) {
      return c.json({ error: "Not a file" }, 400);
    }

    if (isBinary(filePath)) {
      return c.json({ binary: true, size: s.size });
    }

    // Limit to 2MB for text files
    if (s.size > 2 * 1024 * 1024) {
      return c.json({ error: "File too large (> 2MB)", size: s.size }, 400);
    }

    const content = await readFile(filePath, "utf-8");
    const language = detectLanguage(filePath);

    return c.json({ content, language });
  } catch {
    return c.json({ error: `Cannot read file: ${filePath}` }, 400);
  }
});

/** PUT /api/fs/file — write file content */
fs.put("/file", async (c) => {
  const body = await c.req.json<{ path: string; content: string }>();
  if (!body.path || body.content === undefined) {
    return c.json({ error: "path and content required" }, 400);
  }
  const filePath = resolve(body.path);

  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body.content, "utf-8");
    return c.json({ ok: true });
  } catch {
    return c.json({ error: `Cannot write file: ${filePath}` }, 400);
  }
});

/** POST /api/fs/create — create file or directory */
fs.post("/create", async (c) => {
  const body = await c.req.json<{ path: string; type: "file" | "dir" }>();
  if (!body.path || !body.type) {
    return c.json({ error: "path and type required" }, 400);
  }
  const targetPath = resolve(body.path);

  try {
    if (body.type === "dir") {
      await mkdir(targetPath, { recursive: true });
    } else {
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, "", "utf-8");
    }
    return c.json({ ok: true });
  } catch {
    return c.json({ error: `Cannot create: ${targetPath}` }, 400);
  }
});

/** POST /api/fs/upload — upload a file (multipart) */
fs.post("/upload", async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const dirPath = formData.get("path") as string | null;

    if (!file || !dirPath) {
      return c.json({ error: "file and path required" }, 400);
    }

    const targetDir = resolve(dirPath);
    await mkdir(targetDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const targetPath = join(targetDir, file.name);
    await writeFile(targetPath, buffer);

    return c.json({ ok: true, name: file.name });
  } catch {
    return c.json({ error: "Upload failed" }, 400);
  }
});

/** DELETE /api/fs/delete — delete a file or directory */
fs.delete("/delete", async (c) => {
  const body = await c.req.json<{ path: string }>();
  if (!body.path) {
    return c.json({ error: "path required" }, 400);
  }
  const targetPath = resolve(body.path);

  try {
    const s = await stat(targetPath);
    await rm(targetPath, { recursive: s.isDirectory(), force: true });
    return c.json({ ok: true });
  } catch {
    return c.json({ error: `Cannot delete: ${targetPath}` }, 400);
  }
});

export { fs };

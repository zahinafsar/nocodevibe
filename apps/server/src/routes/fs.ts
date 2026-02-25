import { Hono } from "hono";
import { readdir } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
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
]);

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
  } catch (err) {
    return c.json(
      { error: `Cannot read directory: ${current}` },
      400,
    );
  }
});

export { fs };

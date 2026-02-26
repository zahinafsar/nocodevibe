import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Read dist/index.html once at startup ────────────
// Vite builds with base: "/editor/" so all paths already have the prefix.
const DIST_DIR = resolve(import.meta.dir, "../static");
let editorHtml = "";
try {
  editorHtml = readFileSync(resolve(DIST_DIR, "index.html"), "utf-8");
} catch {
  // dist not built yet — will 404
}

export const proxy = new Hono();

// ── /editor → serve built Vite app from dist/ ────────────────────

proxy.get("/editor", (c) => c.redirect("/editor/"));

proxy.get("/editor/", (c) => {
  if (!editorHtml) return c.text("Editor not built. Run: cd apps/web && bun run build", 404);
  return c.html(editorHtml);
});

// Serve static assets (JS, CSS, SVGs) from dist/
proxy.use(
  "/editor/*",
  serveStatic({
    root: DIST_DIR,
    rewriteRequestPath: (path) => path.replace(/^\/editor/, ""),
  })
);

// SPA fallback — serve index.html for any unmatched /editor/* routes
// (e.g. /editor/session/abc123)
proxy.get("/editor/*", (c) => {
  if (!editorHtml) return c.text("Editor not built. Run: cd apps/web && bun run build", 404);
  return c.html(editorHtml);
});

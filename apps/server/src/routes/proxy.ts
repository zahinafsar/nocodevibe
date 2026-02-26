import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Read dist/index.html once at startup ────────────
// Vite builds with base: "/editor/" so all paths already have the prefix.
// Resolve static dir: works in dev (../static from routes/) and bundled CLI (static/ next to dist/)
const __curdir = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = [
  resolve(__curdir, "../static"),  // dev: apps/server/src/routes → apps/server/src/static
  resolve(__curdir, "static"),     // bundled CLI: dist/ → dist/static
].find((d) => existsSync(d)) ?? resolve(__curdir, "../static");

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
    rewriteRequestPath: (path: string) => path.replace(/^\/editor/, ""),
  })
);

// SPA fallback — serve index.html for any unmatched /editor/* routes
// (e.g. /editor/session/abc123)
proxy.get("/editor/*", (c) => {
  if (!editorHtml) return c.text("Editor not built. Run: cd apps/web && bun run build", 404);
  return c.html(editorHtml);
});

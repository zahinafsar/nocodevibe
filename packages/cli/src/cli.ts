import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

// ── ANSI helpers ───────────────────────────────────────────────
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const magenta = (s: string) => `\x1b[35m${s}\x1b[0m`;

// ── 1. Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let port = 3001;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    port = Number(args[i + 1]);
    i++;
  }
  if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
  ${bold("coodeen")} ${dim("— AI coding assistant with live preview")}

  ${yellow("Usage:")}
    ${cyan("npx coodeen")} ${dim("[options]")}

  ${yellow("Options:")}
    ${green("--port")} <number>   Server port ${dim("(default: 3001)")}
    ${green("--help")}, ${green("-h")}        Show this help
`);
    process.exit(0);
  }
}

// ── 2. Set up database ─────────────────────────────────────────
const dataDir = join(homedir(), ".coodeen");
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, "data.db");
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.PORT = String(port);

// Pass the CWD where the user ran the command so the editor can auto-select it
process.env.COODEEN_CWD = process.cwd();

// ── 3. Run Prisma migration ────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = resolve(__dirname, "../prisma/schema.prisma");

// Resolve the local prisma CLI (v6) — avoids npx downloading latest v7 which has breaking changes
const localRequire = createRequire(import.meta.url);
const prismaCli = resolve(dirname(localRequire.resolve("prisma/package.json")), "build", "index.js");

console.log(`\n  ${dim("Initializing database...")}`);
try {
  // Generate Prisma client (needed on first run / after updates)
  execSync(`node "${prismaCli}" generate --schema="${schemaPath}"`, {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  });
  // Push schema to SQLite database
  execSync(`node "${prismaCli}" db push --schema="${schemaPath}" --skip-generate`, {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
  });
} catch (err) {
  console.error("Failed to initialize database:", (err as Error).message);
  process.exit(1);
}

// ── 4. Start the server ────────────────────────────────────────
// Dynamic import so DATABASE_URL is set before Prisma client loads
const { app } = await import("@coodeen/server");
const { serve } = await import("@hono/node-server");

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    const url = `http://localhost:${info.port}/editor/`;
    const cwd = process.cwd();

    console.log(`
  ${bold(green("✓"))} ${bold("Coodeen is running!")}

  ${dim("➜")}  ${bold("Local:")}    ${cyan(url)}
  ${dim("➜")}  ${bold("Project:")}  ${yellow(cwd)}
  ${dim("➜")}  ${bold("Port:")}     ${magenta(String(info.port))}

  ${dim("Press Ctrl+C to stop")}
`);

    // Auto-open browser
    openBrowser(url);
  }
);

function openBrowser(url: string) {
  const { platform } = process;
  try {
    if (platform === "darwin") {
      execSync(`open "${url}"`, { stdio: "ignore" });
    } else if (platform === "win32") {
      execSync(`start "" "${url}"`, { stdio: "ignore" });
    } else {
      execSync(`xdg-open "${url}"`, { stdio: "ignore" });
    }
  } catch {
    // Silently fail — user can open manually
  }
}

<p align="center">
  <img src="https://raw.githubusercontent.com/zahinafsar/coodeen/main/apps/web/public/logo.svg" alt="Coodeen" width="400" />
</p>

<p align="center">
  <strong>AI coding assistant with a split-pane editor — chat on the left, live preview on the right.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/coodeen"><img src="https://img.shields.io/npm/v/coodeen" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/coodeen"><img src="https://img.shields.io/npm/dm/coodeen" alt="npm downloads" /></a>
  <img src="https://img.shields.io/node/v/coodeen" alt="node version" />
  <a href="https://github.com/zahinafsar/coodeen/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/coodeen" alt="license" /></a>
</p>

---

## Quick Start

```bash
npx coodeen
```

That's it. Your browser opens to the editor automatically.

## Features

- **Multi-model chat** — Talk to OpenAI, Anthropic, or Google models about your code
- **Live preview** — See your running app side-by-side with the conversation
- **Screenshot capture** — Select any area of the preview and send it to the AI
- **Session management** — Switch between projects and pick up where you left off
- **Auto project detection** — Automatically uses the directory you run the command from
- **Fully local** — Your API keys, conversations, and data never leave your machine

## Usage

### Start the server

```bash
# Run from your project directory — it auto-selects the folder
cd ~/my-app
npx coodeen

# Custom port
npx coodeen --port 4000

# Show help
npx coodeen --help
```

### Global install

```bash
npm install -g coodeen

coodeen
coodeen --port 8080
```

### Example workflow

```bash
# 1. cd into your project
cd ~/my-app

# 2. Start coodeen
npx coodeen

# 3. Browser opens to http://localhost:3001/editor/
# 4. Add your API key in Settings (gear icon)
# 5. Point the preview panel to your dev server (e.g. http://localhost:3000)
# 6. Start chatting — ask the AI to build features, fix bugs, or explain code
# 7. Capture screenshots from the preview to give the AI visual context
```

## Setup

On first run, Coodeen will:

1. Create `~/.coodeen/` for your local database
2. Initialize the SQLite database automatically
3. Start the server and open your browser

Then configure at least one AI provider through the settings panel:

| Provider | Get API Key | Models |
|----------|-------------|--------|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | GPT-4o, GPT-4.1, GPT-4.1-mini |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | Claude Sonnet, Claude Haiku |
| Google | [aistudio.google.com](https://aistudio.google.com/apikey) | Gemini 2.5 Pro, Gemini 2.5 Flash |

## Requirements

- **Node.js 18+**
- An API key for at least one supported provider

## How It Works

```
┌─────────────────────────────────────────────────┐
│  Coodeen (http://localhost:3001/editor/)         │
├────────────────────┬────────────────────────────┤
│                    │                            │
│   Chat Panel       │   Preview Panel            │
│                    │                            │
│   > Fix the nav    │   ┌──────────────────┐     │
│                    │   │  Your running app │     │
│   AI: I'll update  │   │    (any URL)      │     │
│   the header...    │   │                  │     │
│                    │   └──────────────────┘     │
│   [Screenshot]     │                            │
│                    │                            │
├────────────────────┴────────────────────────────┤
│  Model: gpt-4o  │  Project: ~/my-app            │
└─────────────────────────────────────────────────┘
```

Coodeen runs entirely on your machine:

- **Backend** — Hono server with SQLite (via Prisma), streaming chat via SSE, filesystem access for code editing
- **Frontend** — React app with resizable split-pane layout, Markdown rendering, syntax highlighting

## Architecture

```
coodeen/
├── apps/
│   ├── server/          # Hono API server (Bun + Node.js compatible)
│   │   ├── src/
│   │   │   ├── agent/   # AI chat agent (Vercel AI SDK)
│   │   │   ├── routes/  # API routes (chat, sessions, providers, fs)
│   │   │   ├── tools/   # Code tools (read, write, edit, grep, glob)
│   │   │   └── db/      # Prisma ORM (SQLite)
│   │   └── prisma/      # Database schema
│   └── web/             # React frontend (Vite + Tailwind)
│       └── src/
│           ├── components/
│           │   ├── chat/      # Chat panel, message list, prompt input
│           │   └── preview/   # Preview iframe, screenshot capture
│           └── lib/           # API client, types
└── packages/
    └── cli/             # npm CLI package (npx coodeen)
```

## Development

```bash
# Install dependencies
bun install

# Run dev servers (API + Vite)
bun run dev

# Run individually
bun run dev:server    # API on :3001
bun run dev:web       # Vite on :5173

# Type check
bun run typecheck

# Build for npm
bun run build:npm

# Publish to npm
bun run publish:npm
```

## Data Storage

All data is stored locally:

```
~/.coodeen/
└── data.db          # SQLite database
                     #   - sessions & messages
                     #   - provider API keys
                     #   - app configuration
```

No data is sent anywhere except to the AI provider you configure.

## Troubleshooting

**Port already in use**

```bash
npx coodeen --port 4000
```

**Database issues**

```bash
# Reset the database (deletes all sessions)
rm ~/.coodeen/data.db
npx coodeen
```

**AI can't see screenshots**

Make sure you're using a vision-capable model (GPT-4o, GPT-4.1, Gemini 2.5 Pro). Models like GPT-4.1-nano don't support image inputs.

## License

MIT

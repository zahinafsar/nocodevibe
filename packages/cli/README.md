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
- **Fully local** — Your API keys, conversations, and data never leave your machine

## Usage

### Start the server

```bash
# Default port (3001)
npx coodeen

# Custom port
npx coodeen --port 4000

# Show help
npx coodeen --help
```

### Global install

```bash
# Install globally
npm install -g coodeen

# Then run from anywhere
coodeen
coodeen --port 8080
```

### Example workflow

```bash
# 1. Start coodeen
npx coodeen

# 2. Browser opens to http://localhost:3001/editor/
# 3. Add your API key in Settings (gear icon)
# 4. Select a project folder
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

Coodeen runs a local server that bundles:

- **Backend** — Hono server with SQLite (via Prisma), streaming chat via SSE, filesystem access
- **Frontend** — React app served at `/editor/` with split-pane layout

```
┌─────────────────────────────────────────────────┐
│  Coodeen (http://localhost:3001/editor/)        │
├────────────────────┬────────────────────────────┤
│                    │                            │
│   Chat Panel       │   Preview Panel            │
│                    │                            │
│   > Fix the nav    │   ┌──────────────────┐     │
│                    │   │ Your running app │     │
│   AI: I'll update  │   │    (any URL)     │     │
│   the header...    │   │                  │     │
│                    │   └──────────────────┘     │
│   [Screenshot]     │                            │
│                    │                            │
├────────────────────┴────────────────────────────┤
│  Model: gpt-4o     │  Project: ~/my-app         │
└─────────────────────────────────────────────────┘
```

## Data Storage

All data is stored locally:

```
~/.coodeen/
└── data.db          # SQLite database
                     #   - sessions & messages
                     #   - provider API keys (encrypted at rest)
                     #   - app configuration
```

No data is sent anywhere except to the AI provider you configure.

## Troubleshooting

**Port already in use**

```bash
# Use a different port
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

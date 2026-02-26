// Polyfill TextDecoderStream for older Bun versions
if (typeof globalThis.TextDecoderStream === "undefined") {
  (globalThis as any).TextDecoderStream = class TextDecoderStream extends TransformStream<Uint8Array, string> {
    constructor(encoding = "utf-8", options?: TextDecoderOptions) {
      const decoder = new TextDecoder(encoding, options);
      super({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          if (text) controller.enqueue(text);
        },
        flush(controller) {
          const text = decoder.decode();
          if (text) controller.enqueue(text);
        },
      });
    }
  };
}

import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { cors } from "hono/cors";
import { chat } from "./routes/chat.js";
import { sessions } from "./routes/sessions.js";
import { providers } from "./routes/providers.js";
import { configRoutes } from "./routes/config.js";
import { fs } from "./routes/fs.js";
import { proxy } from "./routes/proxy.js";

const app = new Hono();

// CORS middleware — allow Vite dev origin
app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
  })
);

// Global error handler
app.onError((err, c) => {
  const status = ("status" in err ? err.status : 500) as ContentfulStatusCode;
  return c.json({ error: err.message, code: status }, status);
});

app.get("/", (c) => {
  return c.json({ message: "Coodeen server running" });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Session CRUD routes
app.route("/api/sessions", sessions);

// Chat SSE endpoint
app.route("/api/chat", chat);

// Provider configuration routes
app.route("/api/providers", providers);

// Config routes (active provider, etc.)
app.route("/api/config", configRoutes);

// Filesystem browsing
app.route("/api/fs", fs);

// Editor (built dist)
app.route("/", proxy);

const port = Number(process.env.PORT) || 3001;

console.log(`Coodeen server listening on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};

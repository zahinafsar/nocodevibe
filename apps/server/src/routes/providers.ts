import { Hono } from "hono";
import { provider } from "../db/index.js";

const MODELS: Record<string, string[]> = {
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-4-20250414",
    "claude-3.5-sonnet-20241022",
  ],
  openai: [
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o",
    "gpt-4o-mini",
    "o3",
    "o3-mini",
    "o4-mini",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ],
};

/** Mask an API key: show only the last 4 characters. */
function maskKey(key: string): string {
  if (key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

const providers = new Hono();

// GET /api/providers — list configured providers (keys masked)
providers.get("/", async (c) => {
  const list = await provider.list();
  const masked = list.map((p) => ({ ...p, apiKey: maskKey(p.apiKey) }));
  return c.json(masked);
});

// GET /api/providers/models/:providerName — hardcoded model list
providers.get("/models/:providerName", (c) => {
  const name = c.req.param("providerName").toLowerCase();
  const models = MODELS[name];
  if (!models) {
    return c.json(
      { error: `Unknown provider: ${name}. Supported: ${Object.keys(MODELS).join(", ")}` },
      404,
    );
  }
  return c.json({ provider: name, models });
});

// GET /api/providers/connected-models — all models grouped by connected provider
providers.get("/connected-models", async (c) => {
  const list = await provider.list();
  const result = list
    .filter((p) => MODELS[p.id])
    .map((p) => ({
      providerId: p.id,
      models: MODELS[p.id],
    }));
  return c.json(result);
});

// PUT /api/providers/:id — upsert provider { apiKey }
providers.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ apiKey?: string; modelId?: string }>();

  if (!body.apiKey) {
    return c.json({ error: "apiKey is required" }, 400);
  }

  const result = await provider.upsert(id, {
    apiKey: body.apiKey,
    modelId: body.modelId ?? "",
  });

  return c.json({ ...result, apiKey: maskKey(result.apiKey) });
});

// DELETE /api/providers/:id — remove provider
providers.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const found = await provider.get(id);
  if (!found) {
    return c.json({ error: "Provider not found" }, 404);
  }
  await provider.delete(id);
  return c.json({ ok: true });
});

export { providers };

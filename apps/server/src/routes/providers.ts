import { Hono } from "hono";
import { provider } from "../db/index.js";
import { getFreeModels } from "../agent/freeModels.js";
import { getModelsConfig } from "../agent/modelsConfig.js";

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

// GET /api/providers/models/:providerName — model list from config
providers.get("/models/:providerName", async (c) => {
  const name = c.req.param("providerName").toLowerCase();
  const config = await getModelsConfig();

  if (name === config.free.provider) {
    const free = await getFreeModels();
    return c.json({ provider: name, models: free.map((m) => m.id) });
  }

  const entry = config.providers[name];
  if (!entry) {
    const supported = [...Object.keys(config.providers), config.free.provider].join(", ");
    return c.json({ error: `Unknown provider: ${name}. Supported: ${supported}` }, 404);
  }
  return c.json({ provider: name, models: entry.models });
});

// GET /api/providers/connected-models — all models grouped by connected provider
// Free models are always included first.
providers.get("/connected-models", async (c) => {
  const [list, config, free] = await Promise.all([
    provider.list(),
    getModelsConfig(),
    getFreeModels(),
  ]);

  const result: { providerId: string; label: string; models: string[]; free?: boolean }[] = [
    { providerId: config.free.provider, label: config.free.label, models: free.map((m) => m.id), free: true },
  ];

  for (const p of list) {
    const entry = config.providers[p.id];
    if (entry) {
      result.push({ providerId: p.id, label: entry.label, models: entry.models });
    }
  }

  return c.json(result);
});

// GET /api/providers/free-models — detailed free model info (id + name)
providers.get("/free-models", async (c) => {
  const free = await getFreeModels();
  return c.json(free);
});

// GET /api/providers/config — full models config for frontend
providers.get("/config", async (c) => {
  const config = await getModelsConfig();
  return c.json(config);
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

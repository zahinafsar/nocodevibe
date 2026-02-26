import { Hono } from "hono";
import { config, provider } from "../db/index.js";

const ACTIVE_PROVIDER_KEY = "active-provider";

const configRoutes = new Hono();

// GET /api/config/active-provider — returns active provider slug
configRoutes.get("/active-provider", async (c) => {
  const value = await config.get(ACTIVE_PROVIDER_KEY);
  return c.json({ providerId: value });
});

// PUT /api/config/active-provider — sets active provider { providerId }
configRoutes.put("/active-provider", async (c) => {
  const body = await c.req.json<{ providerId?: string }>();

  if (!body.providerId) {
    return c.json({ error: "providerId is required" }, 400);
  }

  // Verify the provider exists
  const found = await provider.get(body.providerId);
  if (!found) {
    return c.json({ error: `Provider '${body.providerId}' not found. Configure it first.` }, 404);
  }

  await config.set(ACTIVE_PROVIDER_KEY, body.providerId);
  return c.json({ providerId: body.providerId });
});

// GET /api/config/cwd — returns the directory where the CLI was launched
configRoutes.get("/cwd", (c) => {
  return c.json({ cwd: process.env.COODEEN_CWD || null });
});

export { configRoutes };

import { Hono } from "hono";
import { session, message } from "../db/index.js";

const sessions = new Hono();

// POST /api/sessions — create a new session
sessions.post("/", async (c) => {
  const body = await c.req.json<{
    title?: string;
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    previewUrl?: string;
  }>();
  const created = await session.create({
    title: body.title || "New Session",
    providerId: body.providerId,
    modelId: body.modelId,
    projectDir: body.projectDir,
    previewUrl: body.previewUrl,
  });
  return c.json(created, 201);
});

// PATCH /api/sessions/:id — update session settings
sessions.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    previewUrl?: string;
  }>();
  const updated = await session.update(id, body);
  return c.json(updated);
});

// GET /api/sessions — list all sessions sorted by updatedAt desc
sessions.get("/", async (c) => {
  const list = await session.list();
  return c.json(list);
});

// GET /api/sessions/:id — get a single session
sessions.get("/:id", async (c) => {
  const id = c.req.param("id");
  const found = await session.get(id);
  if (!found) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json(found);
});

// DELETE /api/sessions/:id — delete session + cascade messages
sessions.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const found = await session.get(id);
  if (!found) {
    return c.json({ error: "Session not found" }, 404);
  }
  await session.delete(id);
  return c.json({ ok: true });
});

// GET /api/sessions/:id/messages — list messages for a session
sessions.get("/:id/messages", async (c) => {
  const id = c.req.param("id");
  const found = await session.get(id);
  if (!found) {
    return c.json({ error: "Session not found" }, 404);
  }
  const messages = await message.listBySession(id);
  return c.json(messages);
});

export { sessions };

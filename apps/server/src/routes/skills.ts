import { Hono } from "hono";
import { discoverSkills, createSkill, deleteSkill, createSkillRaw } from "../skills/scanner.js";

const skills = new Hono();

/** GET /api/skills — list all skills */
skills.get("/", async (c) => {
  const list = await discoverSkills();
  return c.json(list);
});

/** POST /api/skills — create a new skill */
skills.post("/", async (c) => {
  const body = await c.req.json<{
    name: string;
    description: string;
    content: string;
  }>();
  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }
  const skill = await createSkill(
    body.name,
    body.description || "",
    body.content || "",
  );
  return c.json(skill);
});

/** POST /api/skills/raw — create a skill from raw SKILL.md content */
skills.post("/raw", async (c) => {
  const body = await c.req.json<{ slug: string; raw: string }>();
  if (!body.slug || !body.raw) {
    return c.json({ error: "slug and raw are required" }, 400);
  }
  await createSkillRaw(body.slug, body.raw);
  return c.json({ ok: true });
});

/** DELETE /api/skills — delete a skill */
skills.delete("/", async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name) {
    return c.json({ error: "name is required" }, 400);
  }
  const ok = await deleteSkill(body.name);
  return c.json({ ok });
});

export { skills };

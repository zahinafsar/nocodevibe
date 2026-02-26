import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { message } from "../db/index.js";
import { runAgent } from "../agent/agent.js";

const chat = new Hono();

chat.post("/", async (c) => {
  const body = await c.req.json<{
    sessionId?: string;
    prompt?: string;
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    images?: string[];
  }>();

  if (!body.sessionId) {
    return c.json({ error: "sessionId is required" }, 400);
  }
  if (!body.providerId || !body.modelId) {
    return c.json({ error: "providerId and modelId are required" }, 400);
  }

  const { sessionId, prompt = "", providerId, modelId, images } = body;
  const projectDir = body.projectDir || process.cwd();

  // AbortController so we can cancel the LLM stream on client disconnect
  const controller = new AbortController();

  return streamSSE(c, async (stream) => {
    // Abort LLM stream when client disconnects
    stream.onAbort(() => {
      controller.abort();
    });

    try {
      // Save user message
      await message.append(sessionId, "user", prompt);

      // Run the agent and stream events
      for await (const event of runAgent({
        sessionId,
        prompt,
        providerId,
        modelId,
        projectDir,
        images,
        signal: controller.signal,
      })) {
        if (controller.signal.aborted) break;

        await stream.writeSSE({
          data: JSON.stringify(event),
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      const errorMessage =
        err instanceof Error ? err.message : "Internal server error";
      await stream.writeSSE({
        data: JSON.stringify({ type: "error", message: errorMessage }),
      });
    }
  });
});

export { chat };

import { streamText, stepCountIs } from "ai";
import { resolveProvider, isResolveError } from "./providers.js";
import { message as messageDb } from "../db/index.js";
import { createTools } from "../tools/index.js";
import { getPlanPath, readPlan } from "../tools/plan.js";
import { modelSupportsImage } from "./modelsConfig.js";

/** SSE event types streamed to the client */
export type AgentEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: unknown }
  | { type: "mode_switch"; mode: string; planPath: string; planContent: string }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

export type RunAgentInput = {
  sessionId: string;
  prompt: string;
  providerId: string;
  modelId: string;
  projectDir: string;
  images?: string[];
  mode?: "agent" | "plan";
  signal: AbortSignal;
};

/**
 * Runs the agent: resolves the specified provider+model, streams LLM output,
 * and yields SSE-friendly event objects.
 */
export async function* runAgent({
  sessionId,
  prompt,
  providerId,
  modelId,
  projectDir,
  images,
  mode = "agent",
  signal,
}: RunAgentInput): AsyncGenerator<AgentEvent> {
  // 1. Resolve the specified provider
  const resolved = await resolveProvider(providerId, modelId);

  if (isResolveError(resolved)) {
    yield { type: "error", message: resolved.error };
    return;
  }

  // 2. Build conversation history from DB
  const history = await messageDb.listBySession(sessionId);
  type TextContent = { role: "user" | "assistant" | "system"; content: string };
  type MultiPartContent = {
    role: "user";
    content: Array<{ type: "text"; text: string } | { type: "image"; image: string }>;
  };
  const messages: Array<TextContent | MultiPartContent> = history.map((m) => {
    // Parse stored images for user messages
    if (m.role === "user" && m.images) {
      try {
        const imgs: string[] = JSON.parse(m.images);
        if (imgs.length > 0) {
          const parts: MultiPartContent["content"] = imgs.map((dataUrl) => ({
            type: "image" as const,
            image: dataUrl,
          }));
          parts.push({ type: "text", text: m.content });
          return { role: "user" as const, content: parts };
        }
      } catch { /* fall through to text-only */ }
    }
    return {
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    };
  });

  // Append the current user prompt (with images if present)
  if (images && images.length > 0) {
    const parts: MultiPartContent["content"] = images.map((dataUrl) => ({
      type: "image" as const,
      image: dataUrl,
    }));
    parts.push({ type: "text", text: prompt });
    messages.push({ role: "user", content: parts });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  // 3. System prompt
  const home = process.env.HOME || process.env.USERPROFILE || "/";
  const planPath = getPlanPath(projectDir, sessionId);

  let systemPrompt: string;
  if (mode === "plan") {
    systemPrompt = [
      `You are Coodeen in Plan Mode — a coding assistant with READ-ONLY access.`,
      `You are running on the ${modelId} model.`,
      `The user's home directory is ${home}. The current project directory is ${projectDir}.`,
      `Relative paths resolve against the project directory.`,
      ``,
      `## CRITICAL: Your FIRST response MUST include plan_write`,
      `On the very first user message, you MUST:`,
      `1. Research using read, glob, grep, webfetch, websearch, codesearch — whatever is needed.`,
      `2. Call plan_write with the full detailed plan. Do this in the SAME response. Do NOT stop to ask questions first.`,
      `3. After plan_write, say a brief summary and ask: "Want to modify anything, or should I start building?"`,
      ``,
      `Do NOT describe what you will do. Do NOT outline bullet points of your approach. Do NOT ask clarifying questions. Just research and write the plan immediately in your first response.`,
      ``,
      `## On follow-up messages`,
      `- If the user gives feedback, update the plan via plan_write and ask again.`,
      `- If the user gives ANY green signal (e.g. "looks good", "go ahead", "start", "yes", "do it", "build it"), call plan_exit IMMEDIATELY. No extra steps.`,
      ``,
      `## Rules`,
      `- You CANNOT write or edit project files. Only the plan file is writable via plan_write.`,
      `- NEVER write the full plan in chat. Keep chat messages SHORT.`,
      `- ALL detailed content MUST go into the plan file via plan_write.`,
      `- When the user approves, call plan_exit immediately.`,
    ].join("\n");
  } else {
    // Agent mode — inject existing plan if available
    const existingPlan = await readPlan(planPath);
    const planContext = existingPlan
      ? `\n\n## Active Plan\nA plan was created in plan mode. Follow it closely:\n\n${existingPlan}`
      : "";

    systemPrompt = `You are Coodeen, a coding assistant. You are running on the ${modelId} model. You have full filesystem access — you can read, write, and edit any file on the user's machine. The user's home directory is ${home}. The current project directory is ${projectDir}. Relative paths resolve against the project directory. Always use absolute paths when referencing files outside the project directory. You can search the web with the websearch tool for current information, and use codesearch for programming documentation, API references, and code examples.${planContext}`;
  }

  // 4. Create tools scoped to the project directory (plan mode gets plan_write + plan_exit)
  const supportsVision = await modelSupportsImage(providerId, modelId);
  const tools = createTools(projectDir, mode, planPath, supportsVision);

  // 4. Stream via Vercel AI SDK
  const result = streamText({
    model: resolved.model,
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(25),
    abortSignal: signal,
  });

  // 5. Consume the stream and yield events
  let fullContent = "";

  try {
    for await (const part of result.fullStream) {
      if (signal.aborted) break;

      switch (part.type) {
        case "text-delta": {
          fullContent += part.text;
          yield { type: "token", content: part.text };
          break;
        }
        case "tool-call": {
          yield {
            type: "tool_call",
            name: part.toolName,
            input: part.input,
          };
          break;
        }
        case "tool-result": {
          yield {
            type: "tool_result",
            name: part.toolName,
            output: part.output,
          };
          // Detect plan_exit → emit mode_switch event
          if (part.toolName === "plan_exit" && typeof part.output === "string") {
            try {
              const parsed = JSON.parse(part.output);
              if (parsed.__mode_switch) {
                yield {
                  type: "mode_switch",
                  mode: parsed.mode,
                  planPath: parsed.planPath,
                  planContent: parsed.planContent,
                };
              }
            } catch { /* not JSON, ignore */ }
          }
          break;
        }
        case "error": {
          const errMsg =
            part.error instanceof Error ? part.error.message : String(part.error);
          yield { type: "error", message: errMsg };
          return;
        }
        // step-start, step-finish, finish, etc. — ignore
        default:
          break;
      }
    }

    // 6. Save the assistant message and send done
    if (fullContent.length > 0) {
      const saved = await messageDb.append(sessionId, "assistant", fullContent);
      yield { type: "done", messageId: saved.id };
    } else {
      yield { type: "done", messageId: "" };
    }
  } catch (err) {
    if (signal.aborted) {
      // Client disconnected — silently stop
      return;
    }
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    yield { type: "error", message: errorMessage };
  }
}

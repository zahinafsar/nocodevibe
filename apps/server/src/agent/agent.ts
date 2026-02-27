import { streamText, stepCountIs } from "ai";
import { resolveProvider, isResolveError } from "./providers.js";
import { message as messageDb } from "../db/index.js";
import { createTools } from "../tools/index.js";
import { getPlanPath, readPlan } from "../tools/plan.js";

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
      `## Planning Workflow`,
      `1. **Understand** — Read the user's request carefully. Ask clarifying questions if needed.`,
      `2. **Explore** — Use read, glob, grep, webfetch, websearch, codesearch to understand the codebase and gather context.`,
      `3. **Analyze** — Identify affected files, dependencies, and potential risks.`,
      `4. **Plan** — Write a detailed implementation plan using the plan_write tool. Include:`,
      `   - Summary of changes`,
      `   - Files to create/modify/delete with specific descriptions`,
      `   - Step-by-step implementation order`,
      `   - Edge cases and risks`,
      `5. **Exit** — When the plan is complete, call plan_exit to signal the user can switch to agent mode.`,
      ``,
      `## Rules`,
      `- You CANNOT write or edit project files. Only the plan file is writable via plan_write.`,
      `- Do NOT attempt to modify any project files.`,
      `- NEVER write the full plan in your chat response. Your chat messages should be SHORT — only bullet-point summaries of what you found and what you plan to do.`,
      `- ALL detailed plan content (code snippets, file lists, step-by-step instructions) MUST go into the plan file via plan_write. Do NOT put it in the chat.`,
      `- In chat, respond with brief bullet points only. Use plan_write for everything else.`,
      `- Use plan_write to save your plan. You can call it multiple times to refine.`,
      `- When satisfied with the plan, call plan_exit to hand off to agent mode.`,
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
  const tools = createTools(projectDir, mode, planPath);

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

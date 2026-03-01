import { streamText, stepCountIs } from "ai";
import { resolveProvider, isResolveError } from "./providers.js";
import { message as messageDb } from "../db/index.js";
import { createTools } from "../tools/index.js";
import { getPlanPath, readPlan } from "../tools/plan.js";
import { modelSupportsImage } from "./modelsConfig.js";

/** SSE event types streamed to the client */
export type AgentEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; input: unknown; toolCallId: string }
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
      `## FIRST response: call the question tool then STOP`,
      `On the very first user message you MUST:`,
      `1. Read the user's request carefully.`,
      `2. Call the \`question\` tool with 2-5 clarifying questions.`,
      `   - "text" type for open-ended questions (textarea).`,
      `   - "single_select" with options for one-answer questions (radio buttons).`,
      `   - "multi_select" with options for multi-answer questions (checkboxes).`,
      `3. After calling the question tool, STOP. Do NOT research or plan yet.`,
      `   The user's answers will arrive as the next message.`,
      ``,
      `## When user answers arrive (follow-up message starting with "Answers:")`,
      `1. Research using read, glob, grep, webfetch, websearch, codesearch as needed.`,
      `2. Output the plan directly in chat as a concise bullet-point list.`,
      `3. Also call plan_write with the same plan content. Do NOT skip plan_write.`,
      `4. After the plan, ask: "Would you like to modify this plan or execute it?"`,
      ``,
      `## On other follow-up messages`,
      `- If the user wants to modify: revise the plan, call plan_write with updated plan, ask again.`,
      `- If the user gives ANY green signal (e.g. "execute", "looks good", "go ahead", "start", "yes", "do it", "build it"), tell them to switch to Agent mode and send a message to start building. Do NOT call plan_exit.`,
      ``,
      `## Rules`,
      `- You CANNOT write or edit project files. Only the plan file is writable via plan_write.`,
      `- Do NOT generate README files or any other files. The plan lives in chat as bullet points.`,
      `- Do NOT call plan_exit. The user will switch modes manually.`,
      `- ALWAYS call question tool first before planning. Never skip the clarification step.`,
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
            toolCallId: part.toolCallId,
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

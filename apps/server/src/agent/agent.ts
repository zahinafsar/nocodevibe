import { streamText, stepCountIs } from "ai";
import { resolveProvider, isResolveError } from "./providers.js";
import { message as messageDb } from "../db/index.js";
import { createTools } from "../tools/index.js";

/** SSE event types streamed to the client */
export type AgentEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: unknown }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

export type RunAgentInput = {
  sessionId: string;
  prompt: string;
  providerId: string;
  modelId: string;
  projectDir: string;
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
  const messages: Array<{ role: "user" | "assistant" | "system"; content: string }> = history.map(
    (m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }),
  );

  // Append the current user prompt
  messages.push({ role: "user", content: prompt });

  // 3. System prompt
  const home = process.env.HOME || process.env.USERPROFILE || "/";
  const systemPrompt = `You are Coodeen, a coding assistant. You are running on the ${modelId} model. You have full filesystem access — you can read, write, and edit any file on the user's machine. The user's home directory is ${home}. The current project directory is ${projectDir}. Relative paths resolve against the project directory. Always use absolute paths when referencing files outside the project directory.`;

  // 4. Create tools scoped to the project directory
  const tools = createTools(projectDir);

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

/** Mirrors the backend AgentEvent union */
export type SSEEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: unknown }
  | { type: "done"; messageId: string }
  | { type: "error"; message: string };

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface ToolCall {
  name: string;
  input: unknown;
  output?: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  isStreaming?: boolean;
  images?: string[];
}

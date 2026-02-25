import type { Session, Message, SSEEvent } from "./types";

const BASE_URL = "http://localhost:3001";

export interface Provider {
  id: string;
  apiKey: string;
  modelId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelsResponse {
  provider: string;
  models: string[];
}

export interface ConnectedModelsItem {
  providerId: string;
  models: string[];
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface DirListResponse {
  current: string;
  parent: string | null;
  dirs: string[];
}

export const api = {
  // ── Filesystem ──────────────────────────────────────────

  /** List subdirectories at a path (defaults to $HOME). */
  listDirs: (path?: string) =>
    request<DirListResponse>(
      `/api/fs/dirs${path ? `?path=${encodeURIComponent(path)}` : ""}`,
    ),

  /** List all configured providers (keys masked). */
  getProviders: () => request<Provider[]>("/api/providers"),

  /** Get available models for a provider name. */
  getModels: (providerName: string) =>
    request<ModelsResponse>(`/api/providers/models/${encodeURIComponent(providerName)}`),

  /** Get all models grouped by connected providers. */
  getConnectedModels: () =>
    request<ConnectedModelsItem[]>("/api/providers/connected-models"),

  /** Upsert a provider config (API key only). */
  saveProvider: (id: string, data: { apiKey: string }) =>
    request<Provider>(`/api/providers/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  /** Delete a provider config. */
  deleteProvider: (id: string) =>
    request<{ ok: boolean }>(`/api/providers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  // ── Sessions ──────────────────────────────────────────────

  /** Create a new chat session. */
  createSession: (title?: string) =>
    request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title: title ?? "New Session" }),
    }),

  /** List all sessions (newest first). */
  getSessions: () => request<Session[]>("/api/sessions"),

  /** Delete a session. */
  deleteSession: (id: string) =>
    request<{ ok: boolean }>(`/api/sessions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  /** Get messages for a session. */
  getMessages: (sessionId: string) =>
    request<Message[]>(`/api/sessions/${encodeURIComponent(sessionId)}/messages`),

  // ── Streaming Chat ────────────────────────────────────────

  /**
   * Send a prompt and stream SSE events.
   * Requires providerId + modelId to specify which model to use.
   */
  streamChat: (
    sessionId: string,
    prompt: string,
    providerId: string,
    modelId: string,
    projectDir?: string,
    signal?: AbortSignal,
  ) => {
    const abortController = new AbortController();

    // Link external signal
    if (signal) {
      signal.addEventListener("abort", () => abortController.abort());
    }

    async function* iterate(): AsyncGenerator<SSEEvent> {
      const res = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, prompt, providerId, modelId, projectDir }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Request failed: ${res.status}`,
        );
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const json = trimmed.slice(5).trim();
          if (!json || json === "[DONE]") continue;
          try {
            yield JSON.parse(json) as SSEEvent;
          } catch {
            // skip malformed JSON
          }
        }
      }

      if (buffer.trim().startsWith("data:")) {
        const json = buffer.trim().slice(5).trim();
        if (json && json !== "[DONE]") {
          try {
            yield JSON.parse(json) as SSEEvent;
          } catch {
            // skip
          }
        }
      }
    }

    return {
      [Symbol.asyncIterator]: () => iterate()[Symbol.asyncIterator](),
      abort: () => abortController.abort(),
    };
  },
};

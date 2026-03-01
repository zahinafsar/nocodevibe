import type { Session, Message, SSEEvent } from "./types";

// Empty string = same-origin (works in both dev proxy and production).
// For local dev with separate Vite + server, set VITE_API_URL in .env.
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

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
  label: string;
  models: string[];
  free?: boolean;
}

export interface FreeModel {
  id: string;
  name: string;
  input: string[];
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

export interface ModelsConfig {
  providers: Record<string, { label: string; models: { id: string; input: string[] }[] }>;
  free: {
    provider: string;
    label: string;
    baseURL: string;
    models: FreeModel[];
  };
}

export interface DirListResponse {
  current: string;
  parent: string | null;
  dirs: string[];
}

export const api = {
  // ── Config ─────────────────────────────────────────────

  /** Get the CWD where the CLI was launched (null in dev mode). */
  getCwd: () => request<{ cwd: string | null }>("/api/config/cwd"),

  // ── Filesystem ──────────────────────────────────────────

  /** List subdirectories at a path (defaults to $HOME). */
  listDirs: (path?: string) =>
    request<DirListResponse>(
      `/api/fs/dirs${path ? `?path=${encodeURIComponent(path)}` : ""}`,
    ),

  /** List files + dirs in a directory (for file tree). */
  listTree: (path: string) =>
    request<{ entries: Array<{ name: string; type: "file" | "dir" }> }>(
      `/api/fs/tree?path=${encodeURIComponent(path)}`,
    ),

  /** Read a file's content + detected language. */
  readFile: (path: string) =>
    request<{ content: string; language: string } | { binary: true; size: number }>(
      `/api/fs/file?path=${encodeURIComponent(path)}`,
    ),

  /** Write file content. */
  writeFile: (path: string, content: string) =>
    request<{ ok: boolean }>("/api/fs/file", {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    }),

  /** Create a new file or directory. */
  createEntry: (path: string, type: "file" | "dir") =>
    request<{ ok: boolean }>("/api/fs/create", {
      method: "POST",
      body: JSON.stringify({ path, type }),
    }),

  /** Delete a file or directory. */
  deleteEntry: (path: string) =>
    request<{ ok: boolean }>("/api/fs/delete", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    }),

  /** Upload a file to a directory. */
  uploadFile: async (dirPath: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", dirPath);
    const res = await fetch(`${BASE_URL}/api/fs/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `Upload failed: ${res.status}`);
    }
    return res.json() as Promise<{ ok: boolean; name: string }>;
  },

  /** List all configured providers (keys masked). */
  getProviders: () => request<Provider[]>("/api/providers"),

  /** Get available models for a provider name. */
  getModels: (providerName: string) =>
    request<ModelsResponse>(`/api/providers/models/${encodeURIComponent(providerName)}`),

  /** Get all models grouped by connected providers (includes free models). */
  getConnectedModels: () =>
    request<ConnectedModelsItem[]>("/api/providers/connected-models"),

  /** Get detailed free model info (id + display name). */
  getFreeModels: () =>
    request<FreeModel[]>("/api/providers/free-models"),

  /** Get the full models config (providers, labels, free models). */
  getModelsConfig: () =>
    request<ModelsConfig>("/api/providers/config"),

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
  createSession: (opts?: {
    title?: string;
    providerId?: string;
    modelId?: string;
    projectDir?: string;
    previewUrl?: string;
  }) =>
    request<Session>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        title: opts?.title ?? "New Session",
        providerId: opts?.providerId,
        modelId: opts?.modelId,
        projectDir: opts?.projectDir,
        previewUrl: opts?.previewUrl,
      }),
    }),

  /** Update session settings (model, projectDir, previewUrl). */
  updateSession: (
    id: string,
    data: { providerId?: string; modelId?: string; projectDir?: string; previewUrl?: string },
  ) =>
    request<Session>(`/api/sessions/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
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
    images?: string[],
    mode?: string,
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
        body: JSON.stringify({ sessionId, prompt, providerId, modelId, projectDir, images, mode }),
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

import { useState, useCallback, useRef, useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import type { ChatMessage, Session, ToolCall } from "../../lib/types";
import { api } from "../../lib/api";
import type { ConnectedModelsItem } from "../../lib/api";
import { MessageList } from "./MessageList";
import { PromptInput, type ModelSelection } from "./PromptInput";
import { SessionDrawer } from "./SessionDrawer";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import logoSvg from "../../assets/logo.svg";

let _msgId = 0;
function nextId() {
  return `local-${++_msgId}-${Date.now()}`;
}

export function ChatPanel() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<(() => void) | null>(null);

  // Model selection state
  const [connectedModels, setConnectedModels] = useState<ConnectedModelsItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);

  // Project directory state
  const [projectDir, setProjectDir] = useState("");

  // Fetch connected models on mount
  useEffect(() => {
    api.getConnectedModels().then((models) => {
      setConnectedModels(models);
      // Auto-select first model if none selected
      if (models.length > 0 && models[0].models.length > 0) {
        setSelectedModel({
          providerId: models[0].providerId,
          modelId: models[0].models[0],
        });
      }
    }).catch(() => {
      // silently fail — will show empty model list
    });
  }, []);

  const loadSession = useCallback(async (session: Session) => {
    setSessionId(session.id);
    setError(null);
    try {
      const msgs = await api.getMessages(session.id);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, []);

  const createSession = useCallback(async () => {
    setError(null);
    try {
      const session = await api.createSession();
      setSessionId(session.id);
      setMessages([]);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }, []);

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!selectedModel) {
        setError("Please select a model first.");
        return;
      }

      setError(null);

      let sid = sessionId;
      if (!sid) {
        try {
          const session = await api.createSession();
          sid = session.id;
          setSessionId(sid);
          setRefreshKey((k) => k + 1);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create session");
          return;
        }
      }

      const userMsg: ChatMessage = { id: nextId(), role: "user", content: prompt };
      const assistantId = nextId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);

      try {
        const stream = api.streamChat(
          sid,
          prompt,
          selectedModel.providerId,
          selectedModel.modelId,
          projectDir || undefined,
        );
        abortRef.current = stream.abort;

        for await (const event of stream) {
          switch (event.type) {
            case "token":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.content } : m,
                ),
              );
              break;
            case "tool_call":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name: event.name, input: event.input } as ToolCall] }
                    : m,
                ),
              );
              break;
            case "tool_result":
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.id !== assistantId) return m;
                  const calls = [...(m.toolCalls ?? [])];
                  for (let i = calls.length - 1; i >= 0; i--) {
                    if (calls[i].name === event.name && calls[i].output === undefined) {
                      calls[i] = { ...calls[i], output: event.output };
                      break;
                    }
                  }
                  return { ...m, toolCalls: calls };
                }),
              );
              break;
            case "done":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false, id: event.messageId || m.id } : m,
                ),
              );
              break;
            case "error":
              setError(event.message);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
              );
              break;
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError(err instanceof Error ? err.message : "Streaming failed");
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [sessionId, selectedModel, projectDir],
  );

  const isEmpty = messages.length === 0;

  return (
    <>
      <SessionDrawer
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewSession={createSession}
        refreshKey={refreshKey}
      />
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
        {error && (
          <Alert variant="destructive" className="m-3 mb-0">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex-1">{error}</AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => setError(null)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Alert>
        )}
        {isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-10 px-6 pb-20 max-w-[680px] mx-auto w-full">
            <img
              src={logoSvg}
              alt="Coodeen"
              className="w-[clamp(200px,50%,420px)] h-auto opacity-80"
            />
            <PromptInput
              onSubmit={sendMessage}
              disabled={streaming}
              streaming={streaming}
              onStop={() => abortRef.current?.()}
              variant="landing"
              connectedModels={connectedModels}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              projectDir={projectDir}
              onProjectDirChange={setProjectDir}
            />
          </div>
        ) : (
          <>
            <MessageList messages={messages} />
            <PromptInput
              onSubmit={sendMessage}
              disabled={streaming}
              streaming={streaming}
              onStop={() => abortRef.current?.()}
              connectedModels={connectedModels}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              projectDir={projectDir}
              onProjectDirChange={setProjectDir}
            />
          </>
        )}
      </div>
    </>
  );
}

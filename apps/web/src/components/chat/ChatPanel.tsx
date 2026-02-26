import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import type { ChatMessage, Message, Session, ToolCall } from "../../lib/types";
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

function dbMsgToChatMsg(m: Message): ChatMessage {
  let images: string[] | undefined;
  if (m.images) {
    try { images = JSON.parse(m.images); } catch { /* ignore */ }
  }
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    images,
  };
}

interface ChatPanelProps {
  previewUrl: string;
  onPreviewUrlChange: (url: string) => void;
}

export function ChatPanel({ previewUrl, onPreviewUrlChange }: ChatPanelProps) {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState<string | null>(urlSessionId ?? null);
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

  // Track whether we've done the initial load for the URL session
  const initialLoadDone = useRef(false);

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

  // Load session from URL on mount
  useEffect(() => {
    if (initialLoadDone.current) return;
    if (!urlSessionId) return;
    initialLoadDone.current = true;

    (async () => {
      try {
        const sessions = await api.getSessions();
        const session = sessions.find((s) => s.id === urlSessionId);
        if (!session) {
          navigate("/", { replace: true });
          return;
        }

        setSessionId(session.id);

        // Restore model + projectDir + previewUrl
        if (session.providerId && session.modelId) {
          setSelectedModel({ providerId: session.providerId, modelId: session.modelId });
        }
        if (session.projectDir) {
          setProjectDir(session.projectDir);
        }
        if (session.previewUrl) {
          onPreviewUrlChange(session.previewUrl);
        }

        const msgs = await api.getMessages(session.id);
        setMessages(msgs.map(dbMsgToChatMsg));
      } catch {
        navigate("/", { replace: true });
      }
    })();
  }, [urlSessionId, navigate, onPreviewUrlChange]);

  const loadSession = useCallback(
    async (session: Session) => {
      setSessionId(session.id);
      setError(null);
      navigate(`/session/${session.id}`);

      // Restore model + projectDir + previewUrl from session
      if (session.providerId && session.modelId) {
        setSelectedModel({ providerId: session.providerId, modelId: session.modelId });
      }
      if (session.projectDir) {
        setProjectDir(session.projectDir);
      }
      if (session.previewUrl) {
        onPreviewUrlChange(session.previewUrl);
      }

      try {
        const msgs = await api.getMessages(session.id);
        setMessages(msgs.map(dbMsgToChatMsg));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load messages");
      }
    },
    [navigate, onPreviewUrlChange],
  );

  const createSession = useCallback(async () => {
    setError(null);
    try {
      const session = await api.createSession({
        providerId: selectedModel?.providerId,
        modelId: selectedModel?.modelId,
        projectDir: projectDir || undefined,
        previewUrl,
      });
      setSessionId(session.id);
      setMessages([]);
      setRefreshKey((k) => k + 1);
      navigate(`/session/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }, [selectedModel, projectDir, previewUrl, navigate]);

  const deleteSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setError(null);
    navigate("/");
  }, [navigate]);

  // Persist model selection to session
  const handleModelChange = useCallback(
    (model: ModelSelection | null) => {
      setSelectedModel(model);
      if (sessionId && model) {
        api.updateSession(sessionId, {
          providerId: model.providerId,
          modelId: model.modelId,
        }).catch(() => {});
      }
    },
    [sessionId],
  );

  // Persist projectDir to session
  const handleProjectDirChange = useCallback(
    (dir: string) => {
      setProjectDir(dir);
      if (sessionId) {
        api.updateSession(sessionId, { projectDir: dir }).catch(() => {});
      }
    },
    [sessionId],
  );

  // Persist previewUrl to session when it changes
  const prevPreviewUrl = useRef(previewUrl);
  useEffect(() => {
    if (previewUrl !== prevPreviewUrl.current) {
      prevPreviewUrl.current = previewUrl;
      if (sessionId) {
        api.updateSession(sessionId, { previewUrl }).catch(() => {});
      }
    }
  }, [previewUrl, sessionId]);

  const sendMessage = useCallback(
    async (prompt: string, screenshots?: string[]) => {
      if (!selectedModel) {
        setError("Please select a model first.");
        return;
      }

      setError(null);

      let sid = sessionId;
      if (!sid) {
        try {
          const session = await api.createSession({
            providerId: selectedModel.providerId,
            modelId: selectedModel.modelId,
            projectDir: projectDir || undefined,
            previewUrl,
          });
          sid = session.id;
          setSessionId(sid);
          setRefreshKey((k) => k + 1);
          // Update URL without triggering React Router remount
          window.history.replaceState(null, "", `/editor/session/${sid}`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to create session");
          return;
        }
      }

      const userMsg: ChatMessage = { id: nextId(), role: "user", content: prompt, images: screenshots };
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
          screenshots,
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
    [sessionId, selectedModel, projectDir, previewUrl],
  );

  const isEmpty = messages.length === 0;

  return (
    <>
      <SessionDrawer
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewSession={createSession}
        onDeleteSession={deleteSession}
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
              onModelChange={handleModelChange}
              projectDir={projectDir}
              onProjectDirChange={handleProjectDirChange}
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
              onModelChange={handleModelChange}
              projectDir={projectDir}
              onProjectDirChange={handleProjectDirChange}
            />
          </>
        )}
      </div>
    </>
  );
}

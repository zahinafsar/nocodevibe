import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ChatMessage, Message, Session, ToolCall, Mode, QuestionInfo } from "../../lib/types";
import { api } from "../../lib/api";
import type { ConnectedModelsItem } from "../../lib/api";
import { MessageList } from "./MessageList";
import { PromptInput, type ModelSelection } from "./PromptInput";
import { SessionDrawer } from "./SessionDrawer";
import { QuestionModal } from "./QuestionModal";
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
  const [refreshKey, setRefreshKey] = useState(0);
  const abortRef = useRef<(() => void) | null>(null);

  // Model selection state
  const [connectedModels, setConnectedModels] = useState<ConnectedModelsItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelSelection | null>(null);

  // Project directory state
  const [projectDir, setProjectDir] = useState("");

  // Mode state
  const [mode, setMode] = useState<Mode>("agent");

  // Pending question state (for plan mode question tool)
  const [pendingQuestion, setPendingQuestion] = useState<{
    questionId: string;
    questions: QuestionInfo[];
  } | null>(null);

  // Track whether we've done the initial load for the URL session
  const initialLoadDone = useRef(false);

  // Fetch connected models + default CWD on mount
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

    // Auto-populate projectDir from CLI launch directory (only if not in a session yet)
    if (!urlSessionId) {
      api.getCwd().then(({ cwd }) => {
        if (cwd && !projectDir) {
          setProjectDir(cwd);
        }
      }).catch(() => {});
    }
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
        toast.error(err instanceof Error ? err.message : "Failed to load messages");
      }
    },
    [navigate, onPreviewUrlChange],
  );

  const createSession = useCallback(async () => {
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
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    }
  }, [selectedModel, projectDir, previewUrl, navigate]);

  const deleteSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
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
        toast.error("Please select a model or connect a provider from settings.");
        return;
      }

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
          toast.error(err instanceof Error ? err.message : "Failed to create session");
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

      let pendingModeSwitch = false;

      try {
        const stream = api.streamChat(
          sid,
          prompt,
          selectedModel.providerId,
          selectedModel.modelId,
          projectDir || undefined,
          screenshots,
          mode,
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
              // Show question modal when the question tool is called.
              // The toolCallId is used as questionId — the same ID is available
              // in the tool's execute() via SDK options, so no side-channel needed.
              if (event.name === "question" && event.toolCallId) {
                const input = event.input as { questions?: QuestionInfo[] };
                if (input.questions) {
                  setPendingQuestion({
                    questionId: event.toolCallId,
                    questions: input.questions,
                  });
                }
              }
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
            case "mode_switch":
              // Auto-switch mode and flag for auto-execution after stream ends
              setMode(event.mode as Mode);
              pendingModeSwitch = true;
              break;
            case "done":
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, isStreaming: false, id: event.messageId || m.id } : m,
                ),
              );
              break;
            case "error":
              toast.error(event.message);
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
              );
              break;
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error(err instanceof Error ? err.message : "Streaming failed");
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }

      // After plan_exit, auto-send a follow-up in agent mode to execute the plan
      if (pendingModeSwitch && sid) {
        // Small delay so UI updates before the next stream starts
        await new Promise((r) => setTimeout(r, 100));
        // Re-invoke sendMessage in agent mode — mode state is already "agent"
        const execPrompt = "Execute the plan that was just created. Follow it step by step.";
        const execUserMsg: ChatMessage = { id: nextId(), role: "user", content: execPrompt };
        const execAssistantId = nextId();
        const execAssistantMsg: ChatMessage = {
          id: execAssistantId,
          role: "assistant",
          content: "",
          toolCalls: [],
          isStreaming: true,
        };
        setMessages((prev) => [...prev, execUserMsg, execAssistantMsg]);
        setStreaming(true);

        try {
          const execStream = api.streamChat(
            sid,
            execPrompt,
            selectedModel.providerId,
            selectedModel.modelId,
            projectDir || undefined,
            undefined,
            "agent",
          );
          abortRef.current = execStream.abort;

          for await (const event of execStream) {
            switch (event.type) {
              case "token":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === execAssistantId ? { ...m, content: m.content + event.content } : m,
                  ),
                );
                break;
              case "tool_call":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === execAssistantId
                      ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name: event.name, input: event.input } as ToolCall] }
                      : m,
                  ),
                );
                break;
              case "tool_result":
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== execAssistantId) return m;
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
                    m.id === execAssistantId ? { ...m, isStreaming: false, id: event.messageId || m.id } : m,
                  ),
                );
                break;
              case "error":
                toast.error(event.message);
                setMessages((prev) =>
                  prev.map((m) => (m.id === execAssistantId ? { ...m, isStreaming: false } : m)),
                );
                break;
            }
          }
        } catch (err) {
          if ((err as Error).name !== "AbortError") {
            toast.error(err instanceof Error ? err.message : "Streaming failed");
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === execAssistantId ? { ...m, isStreaming: false } : m)),
          );
        } finally {
          setStreaming(false);
          abortRef.current = null;
        }
      }
    },
    [sessionId, selectedModel, projectDir, previewUrl, mode],
  );

  const isEmpty = messages.length === 0;

  const handleQuestionSubmit = useCallback(
    async (answers: Array<{ question: string; answer: string | string[] }>) => {
      if (!pendingQuestion) return;
      setPendingQuestion(null);
      // Format answers and send as a new user message
      const formatted = answers
        .map((a) => {
          const val = Array.isArray(a.answer) ? a.answer.join(", ") : a.answer;
          return `${a.question}: ${val}`;
        })
        .join("\n");
      sendMessage(`Answers:\n${formatted}`);
    },
    [pendingQuestion, sendMessage],
  );

  return (
    <>
      <QuestionModal
        open={pendingQuestion !== null}
        questions={pendingQuestion?.questions ?? []}
        onSubmit={handleQuestionSubmit}
      />
      <SessionDrawer
        currentSessionId={sessionId}
        onSelectSession={loadSession}
        onNewSession={createSession}
        onDeleteSession={deleteSession}
        refreshKey={refreshKey}
      />
      <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background">
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
              mode={mode}
              onModeChange={setMode}
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
              mode={mode}
              onModeChange={setMode}
            />
          </>
        )}
      </div>
    </>
  );
}

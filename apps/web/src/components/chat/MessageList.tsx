import { useEffect, useRef, useCallback } from "react";
import type { ChatMessage } from "../../lib/types";
import { MessageBubble } from "./MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);

  const isStreaming = messages.some((m) => m.isStreaming);
  isStreamingRef.current = isStreaming;

  /** Resolve the actual scrollable viewport inside Radix ScrollArea */
  const getViewport = useCallback(
    () =>
      wrapperRef.current?.querySelector<HTMLDivElement>(
        '[data-slot="scroll-area-viewport"]',
      ) ?? null,
    [],
  );

  const isNearBottom = useCallback(() => {
    const el = getViewport();
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }, [getViewport]);

  useEffect(() => {
    if (!isNearBottom()) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const el = getViewport();
      if (!el) return;
      // Instant during streaming to avoid jitter; smooth for new messages
      if (isStreamingRef.current) {
        el.scrollTop = el.scrollHeight;
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [messages, isNearBottom, getViewport]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground text-sm">
        <span className="text-2xl opacity-50">&#128187;</span>
        <span>Start coding — describe what you want to build</span>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="flex-1 min-h-0">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-3 p-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

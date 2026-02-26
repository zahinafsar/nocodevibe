import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../lib/types";
import { ToolCallBlock } from "./ToolCallBlock";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {isUser ? (
          <div>
            {message.images?.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Screenshot ${i + 1}`}
                className="rounded-md max-w-full max-h-48 mb-2"
              />
            ))}
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ) : (
          <>
            {message.toolCalls?.map((tc, i) => (
              <ToolCallBlock key={`${tc.name}-${i}`} toolCall={tc} />
            ))}
            {message.content && (
              <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-code:bg-black/30 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-a:text-blue-400">
                <ReactMarkdown
                  rehypePlugins={[rehypeHighlight]}
                  remarkPlugins={[remarkGfm]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {message.isStreaming && !message.content && !message.toolCalls?.length && (
              <span className="inline-flex items-center gap-1 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
              </span>
            )}
            {message.isStreaming && message.content && (
              <span className="inline-block w-2 h-4 bg-muted-foreground rounded-[1px] animate-pulse ml-0.5 align-text-bottom" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

import type { ToolCall } from "../../lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronRight,
  FileText,
  Search,
  Pencil,
  FilePlus,
  Loader2,
  Terminal,
  Globe,
  Code,
  Link,
  ClipboardList,
  LogOut,
  Image,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

// ── Tool metadata ────────────────────────────────────────

type ToolMeta = {
  icon: React.ElementType;
  label: string;
  color: string;
};

const TOOL_META: Record<string, ToolMeta> = {
  read: { icon: FileText, label: "Read", color: "text-blue-400" },
  glob: { icon: Search, label: "Glob", color: "text-violet-400" },
  grep: { icon: Search, label: "Grep", color: "text-violet-400" },
  edit: { icon: Pencil, label: "Edit", color: "text-amber-400" },
  write: { icon: FilePlus, label: "Write", color: "text-emerald-400" },
  webfetch: { icon: Link, label: "Fetch URL", color: "text-teal-400" },
  websearch: { icon: Globe, label: "Web Search", color: "text-cyan-400" },
  codesearch: { icon: Code, label: "Code Search", color: "text-orange-400" },
  imagefetch: { icon: Image, label: "Fetch Image", color: "text-pink-400" },
  plan_write: { icon: ClipboardList, label: "Write Plan", color: "text-indigo-400" },
  plan_exit: { icon: LogOut, label: "Exit Plan Mode", color: "text-rose-400" },
};

const DEFAULT_META: ToolMeta = {
  icon: Terminal,
  label: "",
  color: "text-muted-foreground",
};

function getMeta(name: string): ToolMeta {
  return TOOL_META[name] ?? { ...DEFAULT_META, label: name };
}

// ── Smart subtitle extraction ────────────────────────────

function getInput(tc: ToolCall): Record<string, unknown> {
  if (tc.input && typeof tc.input === "object" && !Array.isArray(tc.input)) {
    return tc.input as Record<string, unknown>;
  }
  return {};
}

function getSubtitle(tc: ToolCall): string {
  const input = getInput(tc);

  switch (tc.name) {
    case "read":
      return String(input.file_path ?? "");
    case "glob":
      return String(input.pattern ?? "");
    case "grep":
      return String(input.pattern ?? "");
    case "edit":
      return String(input.file_path ?? "");
    case "write":
      return String(input.file_path ?? "");
    case "webfetch":
      return String(input.url ?? "");
    case "websearch":
      return String(input.query ?? "");
    case "codesearch":
      return String(input.query ?? "");
    case "imagefetch":
      return String(input.url ?? "");
    case "plan_write":
      return "Updating plan...";
    case "plan_exit":
      return "Switching to agent mode";
    default:
      return "";
  }
}

function getTags(tc: ToolCall): string[] {
  const input = getInput(tc);
  const tags: string[] = [];

  switch (tc.name) {
    case "read":
      if (input.offset) tags.push(`offset=${input.offset}`);
      if (input.limit) tags.push(`limit=${input.limit}`);
      break;
    case "grep":
      if (input.path) tags.push(String(input.path));
      break;
  }
  return tags;
}

function getOutputSummary(tc: ToolCall): string {
  if (tc.output === undefined) return "";
  const out =
    typeof tc.output === "string" ? tc.output : JSON.stringify(tc.output);

  switch (tc.name) {
    case "glob": {
      if (out === "No files matched the pattern.") return "0 matches";
      const count = out.split("\n").filter(Boolean).length;
      return `${count} match${count === 1 ? "" : "es"}`;
    }
    case "grep": {
      if (out === "No matches found.") return "0 matches";
      const count = out.split("\n").filter(Boolean).length;
      return `${count} match${count === 1 ? "" : "es"}`;
    }
    default:
      return "";
  }
}

// ── Component ────────────────────────────────────────────

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const hasOutput = toolCall.output !== undefined;
  const meta = getMeta(toolCall.name);
  const Icon = meta.icon;
  const subtitle = getSubtitle(toolCall);
  const tags = getTags(toolCall);
  const outputSummary = getOutputSummary(toolCall);

  const outputStr =
    toolCall.output === undefined
      ? ""
      : typeof toolCall.output === "string"
        ? toolCall.output
        : JSON.stringify(toolCall.output, null, 2);

  const imageOutput =
    toolCall.name === "imagefetch" && toolCall.output && typeof toolCall.output === "object"
      ? (toolCall.output as { base64?: string; mime?: string })
      : null;
  const imageDataUrl =
    imageOutput?.base64 && imageOutput?.mime
      ? `data:${imageOutput.mime};base64,${imageOutput.base64}`
      : null;

  // Extract plan markdown content from plan_write input
  const planContent =
    toolCall.name === "plan_write"
      ? String((getInput(toolCall) as { content?: string }).content ?? "")
      : "";

  const hasExpandableContent =
    toolCall.name === "plan_write"
      ? planContent.length > 0
      : hasOutput && outputStr.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-1.5">
      <CollapsibleTrigger
        className={cn(
          "flex items-center gap-2 w-full py-1.5 rounded-md text-xs transition-colors text-left group",
          "hover:bg-accent/50",
          hasExpandableContent ? "cursor-pointer" : "cursor-default",
        )}
      >
        {/* Status icon */}
        {hasOutput ? (
          <Icon className={cn("w-3.5 h-3.5 shrink-0", meta.color)} />
        ) : (
          <Loader2 className={cn("w-3.5 h-3.5 shrink-0 animate-spin", meta.color)} />
        )}

        {/* Tool icon + name */}
        <span
          className={cn(
            "font-medium shrink-0",
            hasOutput ? "text-foreground/70" : "text-foreground",
          )}
        >
          {meta.label}
        </span>

        {/* Subtitle (file path, pattern, etc.) */}
        {subtitle && (
          <span className="text-muted-foreground truncate font-mono">
            {subtitle}
          </span>
        )}

        {/* Parameter tags */}
        {tags.map((tag) => (
          <span
            key={tag}
            className="shrink-0 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono"
          >
            {tag}
          </span>
        ))}

        {/* Right side: summary + chevron */}
        <span className="flex items-center gap-1.5 shrink-0 ml-auto">
          {outputSummary && (
            <span className="text-muted-foreground">{outputSummary}</span>
          )}
          {hasExpandableContent && (
            <ChevronRight
              className={cn(
                "w-3 h-3 text-muted-foreground/50 transition-transform",
                open && "rotate-90",
              )}
            />
          )}
        </span>
      </CollapsibleTrigger>

      {hasExpandableContent && (
        <CollapsibleContent>
          {toolCall.name === "plan_write" && planContent ? (
            <div className="mx-2 mb-1.5 bg-muted/50 rounded-md p-3 max-h-[400px] overflow-y-auto">
              <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-code:bg-black/30 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:before:content-none prose-code:after:content-none prose-a:text-blue-400 prose-headings:text-foreground/90">
                <ReactMarkdown
                  rehypePlugins={[rehypeHighlight]}
                  remarkPlugins={[remarkGfm]}
                >
                  {planContent}
                </ReactMarkdown>
              </div>
            </div>
          ) : imageDataUrl ? (
            <div className="mx-2 mb-1.5">
              <img
                src={imageDataUrl}
                alt="Fetched image"
                className="rounded-md max-w-full max-h-[240px] object-contain"
              />
            </div>
          ) : (
            <pre className="mx-2 mb-1.5 font-mono text-[11px] text-muted-foreground bg-muted/50 rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap break-all max-h-[240px] overflow-y-auto leading-relaxed">
              {outputStr}
            </pre>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

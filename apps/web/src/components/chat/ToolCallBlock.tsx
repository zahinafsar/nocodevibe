import type { ToolCall } from "../../lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ToolCallBlockProps {
  toolCall: ToolCall;
}

export function ToolCallBlock({ toolCall }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const hasOutput = toolCall.output !== undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-md mb-2 overflow-hidden">
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 text-xs font-mono text-muted-foreground hover:bg-accent/50 transition-colors text-left">
        <ChevronRight
          className={cn("h-3 w-3 shrink-0 transition-transform", open && "rotate-90")}
        />
        <span className="text-blue-400 font-semibold">{toolCall.name}</span>
        {hasOutput ? (
          <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-950/50 text-emerald-400 border-emerald-800">
            done
          </Badge>
        ) : (
          <Badge variant="outline" className="ml-auto text-[10px] bg-amber-950/50 text-amber-400 border-amber-800 animate-pulse">
            running
          </Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t px-3 py-2 flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Input
            </span>
            <pre className="font-mono text-xs text-muted-foreground bg-black/30 border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
              {typeof toolCall.input === "string"
                ? toolCall.input
                : JSON.stringify(toolCall.input, null, 2)}
            </pre>
          </div>
          {hasOutput && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Output
              </span>
              <pre className="font-mono text-xs text-muted-foreground bg-black/30 border rounded p-2 overflow-x-auto whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
                {typeof toolCall.output === "string"
                  ? toolCall.output
                  : JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

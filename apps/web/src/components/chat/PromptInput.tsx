import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent } from "react";
import { Send, Square, X, Folder, Cpu } from "lucide-react";
import { useElementSelection } from "../../contexts/ElementSelectionContext";
import type { ConnectedModelsItem } from "../../lib/api";
import { FolderPickerDialog } from "./FolderPickerDialog";
import { ModelPickerDialog } from "./ModelPickerDialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ModelSelection {
  providerId: string;
  modelId: string;
}

interface PromptInputProps {
  onSubmit: (prompt: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  variant?: "default" | "landing";
  connectedModels?: ConnectedModelsItem[];
  selectedModel?: ModelSelection | null;
  onModelChange?: (selection: ModelSelection) => void;
  projectDir?: string;
  onProjectDirChange?: (dir: string) => void;
}

export function PromptInput({
  onSubmit,
  disabled,
  streaming,
  onStop,
  variant = "default",
  connectedModels = [],
  selectedModel,
  onModelChange,
  projectDir = "",
  onProjectDirChange,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const { selections, removeSelection, clearSelections } = useElementSelection();

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const value = textareaRef.current?.value.trim();
      if (!value || disabled) return;

      let finalPrompt = value;
      if (selections.length > 0) {
        const selectionLines = selections
          .map((s) => `[Element: ${s.component} in ${s.file}:${s.line}]`)
          .join("\n");
        finalPrompt = selectionLines + "\n" + value;
        clearSelections();
      }

      onSubmit(finalPrompt);
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = "auto";
      }
    },
    [onSubmit, disabled, selections, clearSelections],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, []);

  const isLanding = variant === "landing";
  const hasModels = connectedModels.length > 0;

  return (
    <form
      className={cn(
        "flex flex-col gap-2 shrink-0",
        isLanding ? "w-full" : "p-3 border-t bg-card"
      )}
      onSubmit={handleSubmit}
    >
      {selections.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selections.map((sel, i) => (
            <Badge
              key={`${sel.component}-${sel.file}-${sel.line}`}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <span className="truncate">
                {sel.component}{" "}
                <span className="text-blue-400">
                  ({sel.file}:{sel.line})
                </span>
              </span>
              <button
                type="button"
                className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                onClick={() => removeSelection(i)}
                aria-label={`Remove ${sel.component} selection`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          className={cn(
            "flex-1 resize-none min-h-[40px] max-h-[200px]",
            isLanding && "bg-card border-border text-[15px] py-3.5 px-4 min-h-[48px]"
          )}
          placeholder="Describe what you want to build..."
          rows={1}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
        />
        {streaming ? (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className={cn("shrink-0", isLanding ? "h-12 w-12" : "h-10 w-10")}
            onClick={onStop}
          >
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className={cn("shrink-0", isLanding ? "h-12 w-12" : "h-10 w-10")}
            disabled={disabled}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasModels && (
          <button
            type="button"
            onClick={() => setModelPickerOpen(true)}
            className="flex items-center gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border hover:bg-accent"
          >
            <Cpu className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[200px]">
              {selectedModel?.modelId || "Select model"}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setFolderPickerOpen(true)}
          className="flex items-center gap-1.5 h-7 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md border border-border hover:bg-accent"
        >
          <Folder className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[200px]">
            {projectDir || "Select folder"}
          </span>
        </button>
      </div>
      <ModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        onSelect={(sel) => onModelChange?.(sel)}
        connectedModels={connectedModels}
        selectedModel={selectedModel}
      />
      <FolderPickerDialog
        open={folderPickerOpen}
        onOpenChange={setFolderPickerOpen}
        onSelect={(path) => onProjectDirChange?.(path)}
        initialPath={projectDir || undefined}
      />
    </form>
  );
}

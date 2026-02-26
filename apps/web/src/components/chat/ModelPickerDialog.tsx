import type { ConnectedModelsItem } from "../../lib/api";
import type { ModelSelection } from "./PromptInput";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ModelPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: ModelSelection) => void;
  connectedModels: ConnectedModelsItem[];
  selectedModel?: ModelSelection | null;
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  onSelect,
  connectedModels,
  selectedModel,
}: ModelPickerDialogProps) {
  function handleSelect(providerId: string, modelId: string) {
    onSelect({ providerId, modelId });
    onOpenChange(false);
  }

  const isSelected = (providerId: string, modelId: string) =>
    selectedModel?.providerId === providerId &&
    selectedModel?.modelId === modelId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Model</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[350px] border rounded-md">
          <div className="flex flex-col">
            {connectedModels.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No models connected
              </div>
            ) : (
              connectedModels.map((group) => (
                <div key={group.providerId}>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-muted/50 flex items-center gap-2">
                    {group.label}
                    {group.free && (
                      <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Free
                      </Badge>
                    )}
                  </div>
                  {group.models.map((m) => (
                    <button
                      key={`${group.providerId}::${m}`}
                      type="button"
                      onClick={() => handleSelect(group.providerId, m)}
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
                    >
                      <span className="truncate flex-1">{m}</span>
                      {isSelected(group.providerId, m) && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

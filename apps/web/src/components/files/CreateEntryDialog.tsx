import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { api } from "../../lib/api";
import { toast } from "sonner";

interface CreateEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentDir: string;
  defaultType?: "file" | "dir";
  onCreated: () => void;
}

export function CreateEntryDialog({
  open,
  onOpenChange,
  parentDir,
  defaultType = "file",
  onCreated,
}: CreateEntryDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"file" | "dir">(defaultType);
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      const path = `${parentDir}/${trimmed}`;
      await api.createEntry(path, type);
      toast.success(`${type === "dir" ? "Folder" : "File"} created`);
      setName("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }, [name, type, parentDir, onOpenChange, onCreated]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreate();
      }
    },
    [handleCreate],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create {type === "dir" ? "Folder" : "File"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              variant={type === "file" ? "default" : "outline"}
              size="sm"
              onClick={() => setType("file")}
            >
              File
            </Button>
            <Button
              variant={type === "dir" ? "default" : "outline"}
              size="sm"
              onClick={() => setType("dir")}
            >
              Folder
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="entry-name">Name</Label>
            <Input
              id="entry-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={type === "dir" ? "folder-name" : "filename.ts"}
              autoFocus
            />
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {parentDir}/{name || "..."}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

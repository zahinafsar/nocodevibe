import { useState, useEffect, useCallback } from "react";
import { Folder, ArrowUp, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface FolderPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function FolderPickerDialog({
  open,
  onOpenChange,
  onSelect,
  initialPath,
}: FolderPickerDialogProps) {
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [dirs, setDirs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [pathInput, setPathInput] = useState("");

  const loadDir = useCallback(async (path?: string) => {
    setLoading(true);
    try {
      const res = await api.listDirs(path);
      setCurrentPath(res.current);
      setParentPath(res.parent);
      setDirs(res.dirs);
      setPathInput(res.current);
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadDir(initialPath || undefined);
    }
  }, [open, initialPath, loadDir]);

  function handleDirClick(name: string) {
    loadDir(currentPath + "/" + name);
  }

  function handleGoUp() {
    if (parentPath) loadDir(parentPath);
  }

  function handlePathSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pathInput.trim()) loadDir(pathInput.trim());
  }

  function handleSelect() {
    onSelect(currentPath);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Project Folder</DialogTitle>
        </DialogHeader>

        <form onSubmit={handlePathSubmit} className="flex gap-2">
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            placeholder="/path/to/project"
            className="flex-1 text-sm font-mono"
          />
          <Button type="submit" variant="outline" size="sm" disabled={loading}>
            Go
          </Button>
        </form>

        <ScrollArea className="h-[350px] border rounded-md">
          <div className="flex flex-col">
            {parentPath && (
              <button
                type="button"
                onClick={handleGoUp}
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors border-b"
              >
                <ArrowUp className="h-4 w-4" />
                <span>..</span>
              </button>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dirs.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No subdirectories
              </div>
            ) : (
              dirs.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleDirClick(name)}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{name}</span>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSelect}>
            Select This Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

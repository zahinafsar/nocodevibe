import { useState, useCallback, useEffect } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  Image,
  Trash2,
} from "lucide-react";
import { api } from "../../lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TreeEntry {
  name: string;
  type: "file" | "dir";
}

interface FileTreeProps {
  rootPath: string;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  refreshKey?: number;
  onRefresh?: () => void;
}

const CODE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h",
  ".rb", ".php", ".swift", ".kt", ".dart", ".lua",
  ".sh", ".bash", ".zsh",
  ".css", ".scss", ".html", ".xml", ".svg",
  ".vue", ".svelte",
]);

const IMAGE_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".avif", ".svg",
]);

function getFileIcon(name: string) {
  const ext = name.includes(".") ? "." + name.split(".").pop()?.toLowerCase() : "";
  if (ext === ".json") return FileJson;
  if (ext === ".md" || ext === ".txt") return FileText;
  if (IMAGE_EXTS.has(ext)) return Image;
  if (CODE_EXTS.has(ext)) return FileCode;
  return File;
}

interface TreeNodeProps {
  entry: TreeEntry;
  path: string;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  treeCache: Map<string, TreeEntry[]>;
  onLoadDir: (dirPath: string) => Promise<void>;
  onDelete: (fullPath: string, isDir: boolean) => void;
  refreshKey?: number;
}

function TreeNode({
  entry,
  path,
  depth,
  selectedFile,
  onSelectFile,
  treeCache,
  onLoadDir,
  onDelete,
  refreshKey,
}: TreeNodeProps) {
  const [open, setOpen] = useState(false);
  const fullPath = `${path}/${entry.name}`;
  const isDir = entry.type === "dir";

  const handleClick = useCallback(async () => {
    if (isDir) {
      const willOpen = !open;
      setOpen(willOpen);
      if (willOpen && !treeCache.has(fullPath)) {
        await onLoadDir(fullPath);
      }
    } else {
      onSelectFile(fullPath);
    }
  }, [isDir, open, fullPath, treeCache, onLoadDir, onSelectFile]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", fullPath);
      e.dataTransfer.setData("application/x-file-path", fullPath);
      e.dataTransfer.effectAllowed = "copy";
    },
    [fullPath],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(fullPath, isDir);
    },
    [fullPath, isDir, onDelete],
  );

  const children = treeCache.get(fullPath);
  const FileIcon = isDir ? (open ? FolderOpen : Folder) : getFileIcon(entry.name);
  const isSelected = selectedFile === fullPath;

  return (
    <div>
      <button
        type="button"
        className={cn(
          "flex items-center w-full text-left text-sm py-0.5 px-1 rounded-sm hover:bg-accent/50 transition-colors group",
          isSelected && "bg-accent text-accent-foreground",
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
        draggable
        onDragStart={handleDragStart}
        title={fullPath}
      >
        {isDir ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground mr-0.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mr-0.5" />
          )
        ) : (
          <span className="w-3.5 shrink-0 mr-0.5" />
        )}
        <FileIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0 mr-1.5",
            isDir ? "text-blue-400" : "text-muted-foreground",
          )}
        />
        <span className="truncate text-[13px] flex-1">{entry.name}</span>
        <span
          role="button"
          tabIndex={-1}
          className="hidden group-hover:flex items-center justify-center h-4 w-4 shrink-0 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-1"
          onClick={handleDeleteClick}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDeleteClick(e as unknown as React.MouseEvent);
          }}
          title={`Delete ${entry.name}`}
        >
          <Trash2 className="h-3 w-3" />
        </span>
      </button>
      {isDir && open && children && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.name}
              entry={child}
              path={fullPath}
              depth={depth + 1}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
              treeCache={treeCache}
              onLoadDir={onLoadDir}
              onDelete={onDelete}
              refreshKey={refreshKey}
            />
          ))}
          {children.length === 0 && (
            <div
              className="text-xs text-muted-foreground/60 italic py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
            >
              Empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileTree({ rootPath, selectedFile, onSelectFile, refreshKey = 0, onRefresh }: FileTreeProps) {
  const [treeCache, setTreeCache] = useState<Map<string, TreeEntry[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const loadDir = useCallback(async (dirPath: string) => {
    try {
      const { entries } = await api.listTree(dirPath);
      setTreeCache((prev) => {
        const next = new Map(prev);
        next.set(dirPath, entries);
        return next;
      });
    } catch {
      // silently fail
    }
  }, []);

  const handleDelete = useCallback(
    async (fullPath: string, isDir: boolean) => {
      const name = fullPath.split("/").pop() ?? fullPath;
      const confirmed = window.confirm(
        `Delete ${isDir ? "folder" : "file"} "${name}"?`,
      );
      if (!confirmed) return;

      try {
        await api.deleteEntry(fullPath);
        toast.success(`Deleted ${name}`);
        if (selectedFile === fullPath || selectedFile?.startsWith(fullPath + "/")) {
          onSelectFile("");
        }
        onRefresh?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [selectedFile, onSelectFile, onRefresh],
  );

  // Load root on mount or when rootPath/refreshKey changes
  useEffect(() => {
    if (!rootPath) return;
    setLoading(true);
    setTreeCache(new Map());
    loadDir(rootPath).finally(() => setLoading(false));
  }, [rootPath, refreshKey, loadDir]);

  const rootEntries = treeCache.get(rootPath);

  if (!rootPath) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        Select a project directory
      </div>
    );
  }

  if (loading && !rootEntries) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        Loading...
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootEntries?.map((entry) => (
        <TreeNode
          key={entry.name}
          entry={entry}
          path={rootPath}
          depth={0}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
          treeCache={treeCache}
          onLoadDir={loadDir}
          onDelete={handleDelete}
          refreshKey={refreshKey}
        />
      ))}
      {rootEntries?.length === 0 && (
        <div className="text-xs text-muted-foreground/60 italic py-2 px-4">
          No files found
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ChatPanel } from "../components/chat/ChatPanel";
import { PreviewPanel } from "../components/preview/PreviewPanel";
import { FileExplorerPanel } from "../components/files/FileExplorerPanel";
import { ElementSelectionProvider } from "../contexts/ElementSelectionContext";
import { api } from "../lib/api";
import { cn } from "@/lib/utils";
import type { FileReference } from "../lib/types";

const DEFAULT_PREVIEW_URL = "http://localhost:3000";

type RightTab = "preview" | "files";

export function MainPage() {
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_PREVIEW_URL);
  const [projectDir, setProjectDir] = useState("");
  const [rightTab, setRightTab] = useState<RightTab>("preview");
  const [fileReferences, setFileReferences] = useState<FileReference[]>([]);

  const handlePreviewUrlChange = useCallback((url: string) => {
    setPreviewUrl(url);
  }, []);

  const handleProjectDirChange = useCallback((dir: string) => {
    setProjectDir(dir);
  }, []);

  const handleFileReference = useCallback((ref: FileReference) => {
    setFileReferences((prev) => {
      // Avoid duplicates (same file + same lines)
      const exists = prev.some(
        (r) =>
          r.filePath === ref.filePath &&
          r.startLine === ref.startLine &&
          r.endLine === ref.endLine,
      );
      if (exists) return prev;
      return [...prev, ref];
    });
  }, []);

  const handleRemoveFileReference = useCallback((index: number) => {
    setFileReferences((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFileReferences = useCallback(() => {
    setFileReferences([]);
  }, []);

  // Auto-populate projectDir from CLI CWD on mount
  useEffect(() => {
    api
      .getCwd()
      .then(({ cwd }) => {
        if (cwd && !projectDir) {
          setProjectDir(cwd);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <ElementSelectionProvider>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={25}>
          <ChatPanel
            previewUrl={previewUrl}
            onPreviewUrlChange={handlePreviewUrlChange}
            projectDir={projectDir}
            onProjectDirChange={handleProjectDirChange}
            fileReferences={fileReferences}
            onAddFileReference={handleFileReference}
            onRemoveFileReference={handleRemoveFileReference}
            onClearFileReferences={handleClearFileReferences}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={15}>
          <div className="flex flex-col h-full overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b bg-card shrink-0">
              <button
                type="button"
                onClick={() => setRightTab("preview")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                  rightTab === "preview"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => setRightTab("files")}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors border-b-2",
                  rightTab === "files"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                Files
              </button>
            </div>
            {/* Tab content */}
            <div className="flex-1 min-h-0">
              {rightTab === "preview" ? (
                <PreviewPanel
                  url={previewUrl}
                  onUrlChange={handlePreviewUrlChange}
                />
              ) : (
                <FileExplorerPanel
                  projectDir={projectDir}
                  onFileReference={handleFileReference}
                />
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ElementSelectionProvider>
  );
}

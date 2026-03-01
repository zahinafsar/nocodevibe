import { useState, useCallback, useRef } from "react";
import { FilePlus, FolderPlus, ImagePlus } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { FileTree } from "./FileTree";
import { FileViewer } from "./FileViewer";
import { CreateEntryDialog } from "./CreateEntryDialog";
import { api } from "../../lib/api";
import { toast } from "sonner";
import type { FileReference } from "../../lib/types";

interface FileExplorerPanelProps {
  projectDir: string;
  onFileReference?: (ref: FileReference) => void;
}

export function FileExplorerPanel({
  projectDir,
  onFileReference,
}: FileExplorerPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"file" | "dir">("file");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedFile(path);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleNewFile = useCallback(() => {
    setCreateType("file");
    setCreateDialogOpen(true);
  }, []);

  const handleNewFolder = useCallback(() => {
    setCreateType("dir");
    setCreateDialogOpen(true);
  }, []);

  const handleUploadImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || !projectDir) return;

      for (const file of files) {
        try {
          await api.uploadFile(projectDir, file);
          toast.success(`Uploaded ${file.name}`);
        } catch (err) {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      handleRefresh();
      e.target.value = "";
    },
    [projectDir, handleRefresh],
  );

  // Handle drop on the tree area (images from OS)
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!projectDir) return;

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      for (const file of files) {
        try {
          await api.uploadFile(projectDir, file);
          toast.success(`Uploaded ${file.name}`);
        } catch {
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      handleRefresh();
    },
    [projectDir, handleRefresh],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  if (!projectDir) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-6 text-center">
        Select a project directory to browse files
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-card shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNewFile}
          title="New file"
        >
          <FilePlus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleNewFolder}
          title="New folder"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleUploadImage}
          title="Upload file"
        >
          <ImagePlus className="h-3.5 w-3.5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileUpload}
        />
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
          {projectDir.split("/").pop()}
        </span>
      </div>

      {/* Split panels */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={35} minSize={20}>
          <ScrollArea
            className="h-full"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <FileTree
              rootPath={projectDir}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              refreshKey={refreshKey}
              onRefresh={handleRefresh}
            />
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={65} minSize={30}>
          <FileViewer
            filePath={selectedFile}
            onFileReference={onFileReference}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <CreateEntryDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        parentDir={projectDir}
        defaultType={createType}
        onCreated={handleRefresh}
      />
    </div>
  );
}

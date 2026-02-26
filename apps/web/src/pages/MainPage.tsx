import { useState, useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ChatPanel } from "../components/chat/ChatPanel";
import { PreviewPanel } from "../components/preview/PreviewPanel";
import { ElementSelectionProvider } from "../contexts/ElementSelectionContext";

const DEFAULT_PREVIEW_URL = "http://localhost:3000";

export function MainPage() {
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_PREVIEW_URL);

  const handlePreviewUrlChange = useCallback((url: string) => {
    setPreviewUrl(url);
  }, []);

  return (
    <ElementSelectionProvider>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={25}>
          <ChatPanel
            previewUrl={previewUrl}
            onPreviewUrlChange={handlePreviewUrlChange}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={15}>
          <PreviewPanel url={previewUrl} onUrlChange={handlePreviewUrlChange} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </ElementSelectionProvider>
  );
}

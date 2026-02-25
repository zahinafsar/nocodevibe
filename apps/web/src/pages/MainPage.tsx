import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ChatPanel } from "../components/chat/ChatPanel";
import { PreviewPanel } from "../components/preview/PreviewPanel";
import { ElementSelectionProvider } from "../contexts/ElementSelectionContext";

export function MainPage() {
  return (
    <ElementSelectionProvider>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        <ResizablePanel defaultSize={50} minSize={25}>
          <ChatPanel />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50} minSize={15}>
          <PreviewPanel />
        </ResizablePanel>
      </ResizablePanelGroup>
    </ElementSelectionProvider>
  );
}

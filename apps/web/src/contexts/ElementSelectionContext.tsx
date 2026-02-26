import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export interface ElementSelection {
  component: string;
  file: string;
  line: number;
}

export interface ScreenshotAttachment {
  id: string;
  dataUrl: string;
}

interface ElementSelectionContextValue {
  selections: ElementSelection[];
  addSelection: (selection: ElementSelection) => void;
  removeSelection: (index: number) => void;
  clearSelections: () => void;
  screenshots: ScreenshotAttachment[];
  addScreenshot: (dataUrl: string) => void;
  removeScreenshot: (id: string) => void;
  clearScreenshots: () => void;
}

const ElementSelectionContext =
  createContext<ElementSelectionContextValue | null>(null);

export function ElementSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selections, setSelections] = useState<ElementSelection[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotAttachment[]>([]);

  const addSelection = useCallback((selection: ElementSelection) => {
    setSelections((prev) => {
      const exists = prev.some(
        (s) =>
          s.component === selection.component &&
          s.file === selection.file &&
          s.line === selection.line,
      );
      if (exists) return prev;
      return [...prev, selection];
    });
  }, []);

  const removeSelection = useCallback((index: number) => {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearSelections = useCallback(() => {
    setSelections([]);
  }, []);

  const addScreenshot = useCallback((dataUrl: string) => {
    setScreenshots((prev) => [
      ...prev,
      { id: `ss-${Date.now()}`, dataUrl },
    ]);
  }, []);

  const removeScreenshot = useCallback((id: string) => {
    setScreenshots((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearScreenshots = useCallback(() => {
    setScreenshots([]);
  }, []);

  return (
    <ElementSelectionContext.Provider
      value={{
        selections,
        addSelection,
        removeSelection,
        clearSelections,
        screenshots,
        addScreenshot,
        removeScreenshot,
        clearScreenshots,
      }}
    >
      {children}
    </ElementSelectionContext.Provider>
  );
}

export function useElementSelection() {
  const ctx = useContext(ElementSelectionContext);
  if (!ctx) {
    throw new Error(
      "useElementSelection must be used within an ElementSelectionProvider",
    );
  }
  return ctx;
}

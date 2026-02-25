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

interface ElementSelectionContextValue {
  selections: ElementSelection[];
  addSelection: (selection: ElementSelection) => void;
  removeSelection: (index: number) => void;
  clearSelections: () => void;
}

const ElementSelectionContext =
  createContext<ElementSelectionContextValue | null>(null);

export function ElementSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selections, setSelections] = useState<ElementSelection[]>([]);

  const addSelection = useCallback((selection: ElementSelection) => {
    setSelections((prev) => {
      // Deduplicate by component+file+line
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

  return (
    <ElementSelectionContext.Provider
      value={{ selections, addSelection, removeSelection, clearSelections }}
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

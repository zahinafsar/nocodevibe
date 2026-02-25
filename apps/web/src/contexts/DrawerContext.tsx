import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface DrawerContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const DrawerContext = createContext<DrawerContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <DrawerContext.Provider value={{ open, toggle, close }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  return useContext(DrawerContext);
}

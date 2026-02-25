import { useCallback, useEffect, useRef, useState } from "react";
import { MousePointer, X } from "lucide-react";
import { useElementSelection } from "../../contexts/ElementSelectionContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Script injected into the iframe to enable element selection. */
const INJECTION_SCRIPT = `
(function() {
  if (window.__cooDeenSelectionActive) return;
  window.__cooDeenSelectionActive = true;

  var highlighted = null;
  var originalOutline = '';

  function getReactFiber(el) {
    var keys = Object.keys(el);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].startsWith('__reactFiber$') || keys[i].startsWith('__reactInternalInstance$')) {
        return el[keys[i]];
      }
    }
    return null;
  }

  function walkFiber(fiber) {
    var componentName = null;
    var debugSource = null;
    var current = fiber;
    while (current) {
      if (current._debugSource && !debugSource) {
        debugSource = {
          fileName: current._debugSource.fileName,
          lineNumber: current._debugSource.lineNumber
        };
      }
      if (current.type && typeof current.type === 'function') {
        var name = current.type.displayName || current.type.name;
        if (name && !componentName) {
          componentName = name;
        }
      }
      if (componentName && debugSource) break;
      current = current.return;
    }
    return { component: componentName, source: debugSource };
  }

  function onMouseOver(e) {
    if (highlighted && highlighted !== e.target) {
      highlighted.style.outline = originalOutline;
    }
    highlighted = e.target;
    originalOutline = highlighted.style.outline;
    highlighted.style.outline = '2px solid #3b82f6';
    e.stopPropagation();
  }

  function onMouseOut(e) {
    if (highlighted === e.target) {
      highlighted.style.outline = originalOutline;
      highlighted = null;
      originalOutline = '';
    }
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var el = e.target;
    var fiber = getReactFiber(el);
    var result = { component: null, file: null, line: null };

    if (fiber) {
      var info = walkFiber(fiber);
      if (info.component) result.component = info.component;
      if (info.source) {
        result.file = info.source.fileName;
        result.line = info.source.lineNumber;
      }
    }

    if (!result.component) {
      result.component = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        result.component += '.' + el.className.split(' ')[0];
      }
    }

    window.parent.postMessage({
      type: 'coodeen:element-selected',
      component: result.component,
      file: result.file,
      line: result.line
    }, '*');

    if (highlighted) {
      highlighted.style.outline = originalOutline;
      highlighted = null;
    }
  }

  function cleanup() {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('mouseout', onMouseOut, true);
    document.removeEventListener('click', onClick, true);
    window.__cooDeenSelectionActive = false;
  }

  window.__cooDeenCleanup = cleanup;

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('mouseout', onMouseOut, true);
  document.addEventListener('click', onClick, true);
})();
`;

const CLEANUP_SCRIPT = `
(function() {
  if (window.__cooDeenCleanup) {
    window.__cooDeenCleanup();
  }
  var all = document.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    if (all[i].style.outline && all[i].style.outline.indexOf('#3b82f6') !== -1) {
      all[i].style.outline = '';
    }
  }
})();
`;

function evalInFrame(win: Window, script: string): void {
  new (win as unknown as { Function: typeof Function }).Function(script)();
}

interface SelectionOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  iframeUrl: string;
}

export function SelectionOverlay({ iframeRef, iframeUrl }: SelectionOverlayProps) {
  const [active, setActive] = useState(false);
  const [crossOriginWarning, setCrossOriginWarning] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const { addSelection } = useElementSelection();

  const isSameOrigin = useCallback((): boolean => {
    try {
      const iframeOrigin = new URL(iframeUrl).origin;
      return iframeOrigin === window.location.origin;
    } catch {
      return false;
    }
  }, [iframeUrl]);

  const injectScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return false;
    if (!isSameOrigin()) {
      setCrossOriginWarning(true);
      return false;
    }
    setCrossOriginWarning(false);
    try {
      const win = iframe.contentWindow;
      if (!win) return false;
      evalInFrame(win, INJECTION_SCRIPT);
      return true;
    } catch {
      setCrossOriginWarning(true);
      return false;
    }
  }, [iframeRef, isSameOrigin]);

  const removeScript = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const win = iframe.contentWindow;
      if (!win) return;
      evalInFrame(win, CLEANUP_SCRIPT);
    } catch {
      // Cross-origin or iframe not available
    }
  }, [iframeRef]);

  const toggleSelection = useCallback(() => {
    if (active) {
      removeScript();
      setActive(false);
      setCrossOriginWarning(false);
    } else {
      const injected = injectScript();
      if (injected) {
        setActive(true);
      }
    }
  }, [active, injectScript, removeScript]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || event.data.type !== "coodeen:element-selected") return;
      try {
        const iframeOrigin = new URL(iframeUrl).origin;
        if (event.origin !== iframeOrigin) return;
      } catch {
        // skip
      }
      const { component, file, line } = event.data;
      if (component) {
        addSelection({
          component: component || "Unknown",
          file: file || "unknown",
          line: line ?? 0,
        });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeUrl, addSelection]);

  useEffect(() => {
    return () => {
      if (activeRef.current) {
        const iframe = iframeRef.current;
        if (iframe) {
          try {
            const win = iframe.contentWindow;
            if (win) evalInFrame(win, CLEANUP_SCRIPT);
          } catch {
            // ignore
          }
        }
      }
    };
  }, [iframeRef]);

  return (
    <>
      <Button
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className={cn("h-8 w-8 shrink-0", active && "bg-blue-950 text-blue-400 hover:bg-blue-900")}
        onClick={toggleSelection}
        aria-label={active ? "Cancel element selection" : "Select an element"}
        aria-pressed={active}
      >
        <MousePointer className="h-4 w-4" />
      </Button>

      {crossOriginWarning && (
        <div className="absolute top-[42px] left-2 right-2 z-10 flex items-center justify-between gap-2 px-2.5 py-1.5 bg-amber-950/80 border border-amber-800 rounded text-[11px] text-amber-400">
          Cross-origin iframe &mdash; element selection unavailable
          <button
            className="shrink-0 p-0.5 hover:text-amber-200"
            onClick={() => setCrossOriginWarning(false)}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}

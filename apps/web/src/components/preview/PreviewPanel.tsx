import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SelectionOverlay } from "./SelectionOverlay";
import { useElementSelection } from "../../contexts/ElementSelectionContext";

const DEFAULT_URL = "http://localhost:3000";
const LOAD_TIMEOUT_MS = 10_000;

export function PreviewPanel() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [inputValue, setInputValue] = useState(DEFAULT_URL);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { addScreenshot } = useElementSelection();

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => {
      setError(true);
    }, LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  const navigateIframe = useCallback(
    (targetUrl: string) => {
      setError(false);
      setUrl(targetUrl);
      setInputValue(targetUrl);
      startLoadTimeout();
    },
    [startLoadTimeout],
  );

  const handleReload = useCallback(() => {
    setError(false);
    startLoadTimeout();
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "";
      requestAnimationFrame(() => {
        if (iframeRef.current) {
          iframeRef.current.src = currentSrc;
        }
      });
    }
  }, [startLoadTimeout]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const trimmed = inputValue.trim();
        if (trimmed) {
          navigateIframe(trimmed);
        }
      }
    },
    [inputValue, navigateIframe],
  );

  const handleIframeLoad = useCallback(() => {
    clearLoadTimeout();
    setError(false);
  }, [clearLoadTimeout]);

  const handleIframeError = useCallback(() => {
    clearLoadTimeout();
    setError(true);
  }, [clearLoadTimeout]);

  useEffect(() => {
    startLoadTimeout();
    return clearLoadTimeout;
  }, [startLoadTimeout, clearLoadTimeout]);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* URL bar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-card border-b shrink-0">
        <Input
          className="flex-1 h-8 font-mono text-xs"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleInputKeyDown}
          spellCheck={false}
          aria-label="Preview URL"
        />
        <SelectionOverlay
          iframeRef={iframeRef}
          previewContainerRef={contentRef}
          onScreenshotCaptured={addScreenshot}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleReload}
          aria-label="Reload preview"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Content area */}
      {error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="h-9 w-9 text-amber-500 opacity-70" />
          <p className="text-sm text-muted-foreground max-w-[360px] leading-relaxed">
            Could not load preview &mdash; is your dev server running at{" "}
            <code className="font-mono text-xs bg-muted rounded px-1.5 py-0.5 text-foreground">
              {url}
            </code>
            ?
          </p>
          <Button variant="outline" size="sm" onClick={() => navigateIframe(url)}>
            Retry
          </Button>
        </div>
      ) : (
        <div ref={contentRef} className="flex-1 relative overflow-hidden">
          <iframe
            ref={iframeRef}
            className="w-full h-full border-none bg-white"
            src={url}
            title="Preview"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      )}
    </div>
  );
}

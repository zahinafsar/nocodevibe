import { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  AlertTriangle,
  Monitor,
  Tablet,
  Smartphone,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SelectionOverlay } from "./SelectionOverlay";
import { useElementSelection } from "../../contexts/ElementSelectionContext";
import { cn } from "@/lib/utils";

const LOAD_TIMEOUT_MS = 10_000;

type ViewportMode = "responsive" | "mobile" | "tablet" | "desktop";

const DEFAULTS: Record<Exclude<ViewportMode, "responsive">, { w: number; h: number }> = {
  mobile: { w: 390, h: 844 },
  tablet: { w: 768, h: 1024 },
  desktop: { w: 1440, h: 900 },
};

interface PreviewPanelProps {
  url: string;
  onUrlChange: (url: string) => void;
}

export function PreviewPanel({ url, onUrlChange }: PreviewPanelProps) {
  const [inputValue, setInputValue] = useState(url);
  const [error, setError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Viewport
  const [mode, setMode] = useState<ViewportMode>("responsive");
  const [vpWidth, setVpWidth] = useState(0);
  const [vpHeight, setVpHeight] = useState(0);
  const [rotated, setRotated] = useState(false);

  // Container size for scale-to-fit
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  const { addScreenshot } = useElementSelection();

  useEffect(() => {
    setInputValue(url);
  }, [url]);

  // Observe container size
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setContainerSize({ w: rect.width, h: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clearLoadTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLoadTimeout = useCallback(() => {
    clearLoadTimeout();
    timeoutRef.current = setTimeout(() => setError(true), LOAD_TIMEOUT_MS);
  }, [clearLoadTimeout]);

  const navigateIframe = useCallback(
    (targetUrl: string) => {
      setError(false);
      onUrlChange(targetUrl);
      setInputValue(targetUrl);
      startLoadTimeout();
    },
    [onUrlChange, startLoadTimeout],
  );

  const handleReload = useCallback(() => {
    setError(false);
    startLoadTimeout();
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      iframeRef.current.src = "";
      requestAnimationFrame(() => {
        if (iframeRef.current) iframeRef.current.src = currentSrc;
      });
    }
  }, [startLoadTimeout]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const trimmed = inputValue.trim();
        if (trimmed) navigateIframe(trimmed);
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

  // --- Viewport helpers ---

  const isResponsive = mode === "responsive";
  const effectiveW = rotated ? vpHeight : vpWidth;
  const effectiveH = rotated ? vpWidth : vpHeight;

  const pickMode = useCallback(
    (m: ViewportMode) => {
      if (m === "responsive") {
        setMode("responsive");
        setVpWidth(0);
        setVpHeight(0);
        setRotated(false);
        return;
      }
      // Toggle off if already active
      if (mode === m) {
        setMode("responsive");
        setVpWidth(0);
        setVpHeight(0);
        setRotated(false);
        return;
      }
      setMode(m);
      setVpWidth(DEFAULTS[m].w);
      setVpHeight(DEFAULTS[m].h);
      setRotated(false);
    },
    [mode],
  );

  const toggleRotate = useCallback(() => {
    if (isResponsive) return;
    setRotated((r) => !r);
  }, [isResponsive]);

  // Scale to fit
  const scale = (() => {
    if (isResponsive || containerSize.w === 0) return 1;
    const pad = 32;
    const sX = (containerSize.w - pad) / effectiveW;
    const sY = (containerSize.h - pad) / effectiveH;
    return Math.min(sX, sY, 1);
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-card border-b shrink-0">
        {/* Viewport popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-8 w-8 shrink-0", !isResponsive && "text-primary")}
              title="Viewport settings"
            >
              {mode === "mobile" ? (
                <Smartphone className="h-4 w-4" />
              ) : mode === "tablet" ? (
                <Tablet className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-1.5" sideOffset={4}>
            <p className="text-xs font-medium px-2 pt-1.5 pb-1 text-muted-foreground">Viewport</p>

            {/* Device list */}
            <div className="flex flex-col">
              {(
                [
                  { m: "responsive" as const, icon: Monitor, label: "Responsive", dim: "" },
                  { m: "mobile" as const, icon: Smartphone, label: "Mobile", dim: "390 × 844" },
                  { m: "tablet" as const, icon: Tablet, label: "Tablet", dim: "768 × 1024" },
                  { m: "desktop" as const, icon: Monitor, label: "Desktop", dim: "1440 × 900" },
                ] as const
              ).map(({ m, icon: Icon, label, dim }) => (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm transition-colors",
                    mode === m
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                  onClick={() => pickMode(m)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 text-left">{label}</span>
                  {dim && (
                    <span className="text-[10px] font-mono text-muted-foreground">{dim}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Custom dimensions */}
            {!isResponsive && (
              <>
                <div className="border-t my-1.5" />
                <div className="flex items-center gap-2 px-2 pb-1">
                  <input
                    type="number"
                    className="w-16 h-6 text-[11px] text-center bg-muted rounded px-1 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={effectiveW}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v > 0) {
                        if (rotated) setVpHeight(v);
                        else setVpWidth(v);
                      }
                    }}
                    min={100}
                  />
                  <span className="text-[10px] text-muted-foreground">×</span>
                  <input
                    type="number"
                    className="w-16 h-6 text-[11px] text-center bg-muted rounded px-1 border border-border focus:outline-none focus:ring-1 focus:ring-primary font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={effectiveH}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v > 0) {
                        if (rotated) setVpWidth(v);
                        else setVpHeight(v);
                      }
                    }}
                    min={100}
                  />
                  <button
                    type="button"
                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    onClick={toggleRotate}
                    title="Rotate"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>

        {/* URL input */}
        <Input
          className="flex-1 h-7 font-mono text-xs min-w-0"
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
          className="h-7 w-7 shrink-0"
          onClick={handleReload}
          aria-label="Reload preview"
        >
          <RefreshCw className="h-3.5 w-3.5" />
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
        <div
          ref={contentRef}
          className={cn(
            "flex-1 min-h-0 relative overflow-hidden",
            !isResponsive && "flex items-center justify-center bg-muted/30",
          )}
        >
          {isResponsive ? (
            <iframe
              ref={iframeRef}
              className="w-full h-full border-none bg-white"
              src={url}
              title="Preview"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          ) : (
            <div
              style={{
                width: effectiveW,
                height: effectiveH,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
              }}
              className="shrink-0"
            >
              <iframe
                ref={iframeRef}
                className="w-full h-full border-none bg-white rounded-sm shadow-md border border-border"
                src={url}
                title="Preview"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          )}

          {/* Dimension label */}
          {!isResponsive && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground bg-card/80 backdrop-blur-sm border rounded px-2 py-0.5 font-mono pointer-events-none">
              {effectiveW} × {effectiveH}
              {scale < 1 && ` (${Math.round(scale * 100)}%)`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

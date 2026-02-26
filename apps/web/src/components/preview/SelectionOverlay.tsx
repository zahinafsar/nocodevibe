import { useCallback, useEffect, useRef, useState } from "react";
import { MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { captureTabFrame, cropToDataUrl, type CropRect } from "@/lib/screenshot";

interface SelectionOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  previewContainerRef: React.RefObject<HTMLDivElement | null>;
  onScreenshotCaptured: (dataUrl: string) => void;
}

export function SelectionOverlay({
  iframeRef,
  previewContainerRef,
  onScreenshotCaptured,
}: SelectionOverlayProps) {
  const [active, setActive] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selRect, setSelRect] = useState<CropRect | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setActive(false);
    setDragging(false);
    setSelRect(null);
    startPos.current = null;
  }, []);

  const toggleSelection = useCallback(() => {
    if (active) {
      reset();
    } else {
      setActive(true);
      setSelRect(null);
    }
  }, [active, reset]);

  // Handle Escape to cancel
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, reset]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      startPos.current = { x, y };
      setDragging(true);
      setSelRect({ x, y, width: 0, height: 0 });
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging || !startPos.current || !overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      const currX = e.clientX - rect.left;
      const currY = e.clientY - rect.top;
      const x = Math.min(startPos.current.x, currX);
      const y = Math.min(startPos.current.y, currY);
      const width = Math.abs(currX - startPos.current.x);
      const height = Math.abs(currY - startPos.current.y);
      setSelRect({ x, y, width, height });
    },
    [dragging],
  );

  const handleMouseUp = useCallback(async () => {
    if (!dragging || !selRect || !overlayRef.current) {
      setDragging(false);
      return;
    }
    setDragging(false);

    // Skip tiny selections (accidental clicks)
    if (selRect.width < 10 || selRect.height < 10) {
      setSelRect(null);
      return;
    }

    // Convert overlay-relative coords → viewport coords BEFORE hiding
    const overlayBounds = overlayRef.current.getBoundingClientRect();
    const viewportRect: CropRect = {
      x: overlayBounds.left + selRect.x,
      y: overlayBounds.top + selRect.y,
      width: selRect.width,
      height: selRect.height,
    };

    // Hide overlay so it doesn't appear in the capture
    setActive(false);
    setSelRect(null);

    try {
      // Wait for overlay to be removed from DOM
      await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => requestAnimationFrame(r));

      const bitmap = await captureTabFrame();
      const dataUrl = cropToDataUrl(bitmap, viewportRect);
      onScreenshotCaptured(dataUrl);
    } catch (err) {
      // User denied getDisplayMedia or other error — silently ignore
      console.warn("Screenshot capture failed:", err);
    }
  }, [dragging, selRect, onScreenshotCaptured]);

  return (
    <>
      <Button
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className={cn(
          "h-8 w-8 shrink-0",
          active && "bg-blue-950 text-blue-400 hover:bg-blue-900",
        )}
        onClick={toggleSelection}
        aria-label={active ? "Cancel screenshot selection" : "Take screenshot"}
        aria-pressed={active}
      >
        <MousePointer className="h-4 w-4" />
      </Button>

      {active && previewContainerRef.current && (
        <div
          ref={overlayRef}
          className="absolute inset-0 z-10"
          style={{ cursor: "crosshair" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {selRect && (
            <>
              {/* Dimmed mask — top */}
              <div
                className="absolute left-0 right-0 top-0 bg-black/40"
                style={{ height: selRect.y }}
              />
              {/* Dimmed mask — bottom */}
              <div
                className="absolute left-0 right-0 bottom-0 bg-black/40"
                style={{ top: selRect.y + selRect.height }}
              />
              {/* Dimmed mask — left */}
              <div
                className="absolute left-0 bg-black/40"
                style={{
                  top: selRect.y,
                  width: selRect.x,
                  height: selRect.height,
                }}
              />
              {/* Dimmed mask — right */}
              <div
                className="absolute right-0 bg-black/40"
                style={{
                  top: selRect.y,
                  left: selRect.x + selRect.width,
                  height: selRect.height,
                }}
              />
              {/* Selection border */}
              <div
                className="absolute border-2 border-blue-500 pointer-events-none"
                style={{
                  left: selRect.x,
                  top: selRect.y,
                  width: selRect.width,
                  height: selRect.height,
                }}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

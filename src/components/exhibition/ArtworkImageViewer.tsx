"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ArtworkImage = { src: string; width: number; height: number };

/** How far a tap zooms in, relative to the picture fitted to the screen. */
const zoomFactor = 2.5;

/**
 * The artwork's picture across the whole screen. A tap zooms in on the tapped spot, where it can
 * be dragged around, and another tap zooms back out. It is rendered into the page body, so the
 * panel's slide-in animation cannot confine it.
 */
export function ArtworkImageViewer({ image, alt, onClose }: { image: ArtworkImage; alt: string; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef({ x: 0.5, y: 0.5 });
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  // Keep the tapped spot in the middle of the screen after zooming in.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || !zoomed) return;
    scroller.scrollLeft = focusRef.current.x * scroller.scrollWidth - scroller.clientWidth / 2;
    scroller.scrollTop = focusRef.current.y * scroller.scrollHeight - scroller.clientHeight / 2;
  }, [zoomed]);

  const toggleZoom = (event: React.MouseEvent<HTMLImageElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    focusRef.current = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
    setZoomed((current) => !current);
  };

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-[var(--abyss)] text-[var(--foam)]" role="dialog" aria-modal="true" aria-label={alt}>
      <div ref={scrollRef} className="size-full overflow-auto overscroll-contain">
        <div className={zoomed ? "grid min-h-full min-w-full place-items-center" : "grid size-full place-items-center p-4"}>
          <Image
            src={encodeURI(image.src)}
            alt={alt}
            width={image.width}
            height={image.height}
            unoptimized
            onClick={toggleZoom}
            className={zoomed ? "block h-auto max-w-none cursor-zoom-out" : "block h-auto max-h-full w-auto max-w-full cursor-zoom-in object-contain"}
            style={zoomed ? { width: `${zoomFactor * 100}vmin` } : undefined}
          />
        </div>
      </div>
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-10 flex min-h-11 items-center gap-3 border border-white/45 bg-[var(--abyss)] px-4 text-sm text-white transition-colors hover:border-white"
      >
        <span>Close</span>
        <span aria-hidden="true">×</span>
      </button>
    </div>,
    document.body,
  );
}

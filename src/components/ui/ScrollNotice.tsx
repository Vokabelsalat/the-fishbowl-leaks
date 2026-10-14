"use client";

import type { RefObject } from "react";
import { useCallback, useEffect, useState } from "react";

type ScrollNoticeProps = {
  containerRef?: RefObject<HTMLElement | null>;
  label?: string;
  /**
   * "screen" pins the notice to the top of the screen; "container" sits it at the bottom of the
   * nearest positioned parent, for scroll areas inside panels that would otherwise cover it;
   * "inline" sits in the page flow and stays visible, so hiding it never shifts the layout.
   */
  placement?: "screen" | "container" | "inline";
  /** Element to scroll to instead of moving one screen forward. */
  targetId?: string;
};

export function ScrollNotice({
  containerRef,
  label = "More below — scroll to continue",
  placement = "screen",
  targetId,
}: ScrollNoticeProps) {
  const [visible, setVisible] = useState(false);

  const update = useCallback(() => {
    const target = containerRef?.current;
    if (target) {
      const remaining = target.scrollHeight - target.clientHeight - target.scrollTop;
      setVisible(target.scrollHeight > target.clientHeight + 8 && remaining > 16);
      return;
    }

    const root = document.scrollingElement;
    if (!root) return;
    const remaining = root.scrollHeight - window.innerHeight - window.scrollY;
    setVisible(root.scrollHeight > window.innerHeight + 8 && remaining > 16);
  }, [containerRef]);

  useEffect(() => {
    const target = containerRef?.current;
    const scrollTarget: HTMLElement | Window = target ?? window;
    const resizeTarget = target ?? document.documentElement;
    const observer = new ResizeObserver(update);
    const mutationObserver = new MutationObserver(update);

    update();
    scrollTarget.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    observer.observe(resizeTarget);
    mutationObserver.observe(resizeTarget, { childList: true, subtree: true });

    return () => {
      scrollTarget.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [containerRef, update]);

  function moveForward() {
    const destination = targetId ? document.getElementById(targetId) : null;
    if (destination) {
      destination.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const target = containerRef?.current;
    const amount = (target?.clientHeight ?? window.innerHeight) * 0.72;
    if (target) {
      target.scrollBy({ top: amount, behavior: "smooth" });
    } else {
      window.scrollBy({ top: amount, behavior: "smooth" });
    }
  }

  const button = (
    <button
      type="button"
      onClick={moveForward}
      className="pointer-events-auto flex min-h-11 items-center gap-3 bg-[var(--phosphor)] px-5 text-sm text-[#031015] shadow-[0_0_2rem_rgba(184,255,69,0.22)] transition-transform active:scale-[0.98]"
    >
      <span>{label}</span>
      <span aria-hidden="true">↓</span>
    </button>
  );

  if (placement === "inline") return <div className="flex">{button}</div>;

  if (!visible) return null;

  return (
    <div
      className={placement === "screen"
        ? "safe-top pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4"
        : "pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-4"}
      role="status"
    >
      {button}
    </div>
  );
}

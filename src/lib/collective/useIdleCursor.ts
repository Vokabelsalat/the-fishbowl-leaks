"use client";

import { useEffect, useState } from "react";

/**
 * Whether the mouse pointer should be hidden: true until the mouse moves and again once it has rested
 * for `idleMilliseconds`, so the pointer does not sit on the shared screen while nobody uses it.
 */
export function useIdleCursor(idleMilliseconds = 3000) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      setHidden(false);
      clearTimeout(timer);
      timer = setTimeout(() => setHidden(true), idleMilliseconds);
    };
    const events = ["pointermove", "pointerdown", "wheel", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, wake, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, wake));
    };
  }, [idleMilliseconds]);

  return hidden;
}

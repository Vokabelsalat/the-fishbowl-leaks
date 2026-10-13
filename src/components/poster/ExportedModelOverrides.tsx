"use client";

import { useState, type ReactNode } from "react";
import type { ExportedModelOverrides as Overrides } from "@/lib/poster/exportOverrides";

/**
 * Writes the exporting browser's saved overrides into the headless Chrome's storage before the
 * poster renders, so its creatures, plants and add-ons are built as edited from the start.
 */
export function ExportedModelOverrides({ overrides, children }: { overrides: Overrides; children: ReactNode }) {
  useState(() => {
    if (typeof window === "undefined") return;
    Object.entries(overrides).forEach(([key, value]) => window.localStorage.setItem(key, value));
  });
  return children;
}

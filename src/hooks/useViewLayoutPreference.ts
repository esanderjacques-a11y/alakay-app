"use client";

import { useCallback, useState } from "react";
import {
  persistViewLayoutPreference,
  readViewLayoutPreference,
  type ViewLayoutMode,
} from "@/lib/viewLayoutPreference";

export function useViewLayoutPreference(
  scope: string,
  fallback: ViewLayoutMode = "grid"
) {
  const [layout, setLayoutState] = useState<ViewLayoutMode>(() =>
    readViewLayoutPreference(scope, fallback)
  );

  const setLayout = useCallback(
    (mode: ViewLayoutMode) => {
      setLayoutState(mode);
      persistViewLayoutPreference(scope, mode);
    },
    [scope]
  );

  return [layout, setLayout] as const;
}

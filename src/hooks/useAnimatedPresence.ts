"use client";

import { useEffect, useState } from "react";

export function useAnimatedPresence(open: boolean, durationMs = 180) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      const timeout = window.setTimeout(() => {
        setMounted(true);
        setLeaving(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    if (!mounted) return;
    const startTimeout = window.setTimeout(() => setLeaving(true), 0);
    const timeout = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, durationMs);

    return () => {
      window.clearTimeout(startTimeout);
      window.clearTimeout(timeout);
    };
  }, [durationMs, mounted, open]);

  return { mounted, leaving };
}

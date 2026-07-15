"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  /** Extra classes on the dialog panel (e.g. export-report-modal). */
  className?: string;
};

export default function AppModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeLabel = "Close",
  className = "",
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [canPortal, setCanPortal] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setCanPortal(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    overlayRef.current?.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || !canPortal) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="app-modal-root"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-modal-shell app-modal-panel app-modal-panel--${size} animate-scale-in${className ? ` ${className}` : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <div className="min-w-0 flex-1">
            <h2 className="app-modal-title">{title}</h2>
            {description ? (
              <p className="app-modal-desc">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-modal-close shrink-0"
            aria-label={closeLabel}
          >
            <X size={18} />
          </button>
        </header>

        <div className="app-modal-body">{children}</div>

        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body
  );
}

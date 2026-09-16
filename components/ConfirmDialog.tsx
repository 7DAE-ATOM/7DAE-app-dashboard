"use client";

import { useEffect, useRef } from "react";

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Themed replacement for `window.confirm()` — same overlay/focus/Escape
 * mechanics as `components/AboutDialog.tsx`, so it stays consistent with the
 * rest of the dashboard in both themes.
 *
 * Deliberately generic: any native confirm on a destructive or heavy action
 * can move here.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: Readonly<Props>) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe action, not the one that goes ahead.
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="border-b border-border px-5 py-3 text-base font-semibold text-fg"
        >
          {title}
        </h2>
        <p className="px-5 py-4 text-sm text-fg">{message}</p>
        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

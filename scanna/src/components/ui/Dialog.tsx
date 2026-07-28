"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  children: ReactNode;
  className?: string;
}

/** Uses the native <dialog> element — built-in focus trap, Escape-to-close,
 * and top-layer stacking, satisfying accessibility.md's keyboard-nav rules
 * without hand-rolling focus management. */
export function Dialog({ open, onClose, titleId, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-paper p-0 text-ink",
        "backdrop:bg-ink/50",
        className,
      )}
    >
      <div className="p-5">{children}</div>
    </dialog>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "ink" | "gold" | "slate" | "plum" | "danger" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  ink: "bg-ink text-bone",
  gold: "bg-gold-soft text-ink",
  slate: "bg-slate-soft text-ink",
  plum: "bg-plum-soft text-ink",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-bone-100 text-ink-70 border border-border",
};

export function Badge({
  tone = "neutral",
  children,
  icon,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

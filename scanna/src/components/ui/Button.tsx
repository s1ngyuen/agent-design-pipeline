"use client";

import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant =
  | "primary" // ink — main routine actions (Save, Capture)
  | "accent" // gold — highlighted primary CTA
  | "secondary" // slate outline — secondary actions
  | "plum" // reserved for the one irreversible action (Publish to eBay)
  | "danger" // destructive (Delete)
  | "ghost"; // text-only

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-ink text-bone hover:bg-ink/90 disabled:bg-ink/40",
  // Hover uses a brightness filter rather than swapping to --color-gold-dark:
  // gold-dark is tuned for *text* contrast (4.5:1+ on light backgrounds),
  // which makes it too dark to pair with ink text as a button fill (ink-on-
  // gold-dark measures ~3.3:1, below AA). brightness-95 darkens the same
  // hue slightly for a visible hover state without breaking the ink-on-gold
  // contrast ratio.
  accent: "bg-gold text-ink hover:brightness-95 disabled:bg-gold/40",
  secondary:
    "bg-paper text-ink border border-border hover:bg-bone-100 disabled:text-ink-50",
  plum: "bg-plum text-bone border-2 border-plum-dark hover:bg-plum-dark disabled:bg-plum/40",
  danger: "bg-danger text-bone hover:bg-danger/90 disabled:bg-danger/40",
  ghost: "bg-transparent text-ink hover:bg-bone-100 disabled:text-ink-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-[44px] px-3 text-sm gap-1.5",
  md: "min-h-[44px] px-4 text-base gap-2",
  lg: "min-h-[52px] px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

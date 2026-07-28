import clsx, { type ClassValue } from "clsx";

/** Thin wrapper around clsx — no Tailwind class-merging library needed since
 * we don't conditionally override conflicting utilities in this codebase. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

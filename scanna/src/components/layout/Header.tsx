import { signOutAction } from "@/app/(app)/actions";

/** Slim top bar: app name (mobile only — desktop sidebar already shows it)
 * + sign out. Page-level H1s and contextual actions (e.g. "Scan Next",
 * "Edit Card") live inside each page per content.md, not here, so there's
 * exactly one <h1> per page. */
export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-border bg-paper px-4 py-3 lg:hidden">
      <span className="font-heading text-lg font-semibold text-ink">Scanna</span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="min-h-[44px] rounded-lg px-3 text-sm font-medium text-ink-70 hover:bg-bone-100"
        >
          Sign out
        </button>
      </form>
    </header>
  );
}

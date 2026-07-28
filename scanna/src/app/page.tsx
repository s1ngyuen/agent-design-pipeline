import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = {
  title: "Scanna — Scan Cards, Know Their Value, Sell Smarter",
  description:
    "Scan a sports card to identify it, get a researched value estimate, and manage your whole resale inventory — from acquisition to eBay sale.",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/scan");
  }
  const { error } = await searchParams;

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-bone px-4 py-16">
      <main className="w-full max-w-md">
        <p className="mb-8 text-center font-heading text-sm font-semibold uppercase tracking-wide text-gold-dark">
          Scanna
        </p>

        <h1 className="text-balance text-center font-heading text-3xl font-semibold leading-tight text-ink sm:text-4xl">
          Point your phone at a card. Know what it&apos;s worth.
        </h1>

        <p className="mt-4 text-center text-base leading-relaxed text-ink-70">
          Scanna identifies your cards, researches real recent sales, and gives you a value estimate you can
          actually see the reasoning behind — then helps you list, track, and sell on eBay when you&apos;re
          ready.
        </p>

        {error && (
          <div role="alert" className="mt-6 rounded-lg border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
            <p className="font-semibold">Couldn&apos;t sign you in.</p>
            <p>
              Check your connection and try again — if this keeps happening, the Google sign-in service may be
              temporarily down.
            </p>
          </div>
        )}

        <form action={signInWithGoogle} className="mt-8">
          <button
            type="submit"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-lg bg-ink px-6 text-base font-semibold text-bone transition-colors hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-gold focus-visible:outline-offset-2"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
              <path
                fill="currentColor"
                d="M21.35 11.1H12v2.9h5.35c-.24 1.4-1.6 4.1-5.35 4.1a5.9 5.9 0 1 1 0-11.8c1.68 0 2.8.7 3.44 1.3l2.35-2.27C16.4 3.9 14.4 3 12 3a9 9 0 1 0 0 18c5.2 0 8.6-3.65 8.6-8.8 0-.6-.07-1.05-.25-1.1z"
              />
            </svg>
            Sign in with Google
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-ink-50">
          Your inventory is private to your account. Nothing here is shared or traded with other users.
        </p>

        <ul className="mt-10 space-y-2 border-t border-border pt-6 text-sm text-ink-70">
          <li>· Scan or manually enter — your call</li>
          <li>· Every value estimate shows its sources and confidence</li>
          <li>· Nothing goes live on eBay until you say so</li>
        </ul>

        <p className="mt-10 text-center text-xs italic text-ink-50">
          Scanna — scan it, know what it&apos;s worth, decide for yourself.
        </p>
      </main>
    </div>
  );
}

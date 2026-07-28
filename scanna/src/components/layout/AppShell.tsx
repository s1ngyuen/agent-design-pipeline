import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { OfflineBanner } from "./OfflineBanner";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col lg:pl-56">
      <BottomNav />
      <Header />
      <OfflineBanner />
      <main id="main-content" className="flex-1 pb-16 lg:pb-6">
        <div className="mx-auto w-full max-w-screen-lg px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}

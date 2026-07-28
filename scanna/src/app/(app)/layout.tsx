import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";

// Defense-in-depth alongside src/proxy.ts (per proxy.ts's own comment: never
// rely on Proxy alone for authorization) — every route under (app)/ is
// re-checked here server-side.
export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }
  return <AppShell>{children}</AppShell>;
}

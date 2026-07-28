import type { Metadata } from "next";
import { DashboardPageClient } from "./DashboardPageClient";

export const metadata: Metadata = {
  title: "Dashboard — Scanna",
  description: "Your resale business at a glance — inventory value, profit and loss, and sales history in one view.",
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}

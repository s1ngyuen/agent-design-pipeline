import type { Metadata } from "next";
import { ResearchPageClient } from "./ResearchPageClient";

export const metadata: Metadata = {
  title: "Research a Card's Value — Scanna",
  description: "Scan or enter a card to check its value before you buy — no need to add it to your inventory.",
};

export default function ResearchPage() {
  return <ResearchPageClient />;
}

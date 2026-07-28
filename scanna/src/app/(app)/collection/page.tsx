import type { Metadata } from "next";
import { CollectionPageClient } from "./CollectionPageClient";

export const metadata: Metadata = {
  title: "Your Collection — Scanna",
  description: "Browse, search, and manage your full sports card inventory — status, estimated value, and quick actions in one place.",
};

export default function CollectionPage() {
  return <CollectionPageClient />;
}

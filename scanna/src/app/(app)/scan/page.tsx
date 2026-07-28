import type { Metadata } from "next";
import { ScanPageClient } from "./ScanPageClient";

export const metadata: Metadata = {
  title: "Scan a Card — Scanna",
  description: "Hold a card up to your camera to identify it instantly, or scan a PSA/BGS cert barcode for an exact match.",
};

export default function ScanPage() {
  return <ScanPageClient />;
}

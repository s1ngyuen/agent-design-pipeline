import type { Metadata } from "next";
import { ListingsPageClient } from "./ListingsPageClient";

export const metadata: Metadata = {
  title: "eBay Listings — Scanna",
  description: "Track every card currently listed on eBay — status, price, views, and watchers, synced from your seller account.",
};

export default function ListingsPage() {
  return <ListingsPageClient />;
}

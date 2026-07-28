import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { getDb, schema } from "@/db";
import { CardDetailPageClient } from "./CardDetailPageClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return { title: "Card — Scanna" };

  const [card] = await getDb()
    .select()
    .from(schema.cards)
    .where(and(eq(schema.cards.id, id), eq(schema.cards.user_id, session.user.id)));

  if (!card) return { title: "Card — Scanna" };

  return {
    title: `${card.player} — ${card.year} ${card.product} #${card.card_number} — Scanna`,
    description: `Full record for this ${card.player} card: acquisition details, value estimate breakdown, listing history, and eBay actions.`,
  };
}

export default async function CardDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <CardDetailPageClient id={id} />;
}

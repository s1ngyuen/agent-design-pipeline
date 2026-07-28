CREATE TABLE "checklist_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" "sport" NOT NULL,
	"year" text NOT NULL,
	"manufacturer" text NOT NULL,
	"product" text NOT NULL,
	"subset" text NOT NULL,
	"card_number" text,
	"player" text NOT NULL,
	"team" text,
	"parallel_name" text,
	"print_run" integer,
	"is_auto" boolean DEFAULT false NOT NULL,
	"is_rookie" boolean DEFAULT false NOT NULL,
	"source_url" text,
	"search_text" text GENERATED ALWAYS AS (lower(coalesce(player, '') || ' ' || coalesce(team, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(product, '') || ' ' || coalesce(subset, '') || ' ' || coalesce(card_number, '') || ' ' || coalesce(year, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "checklist_cards_product_subset_idx" ON "checklist_cards" USING btree ("product","subset");--> statement-breakpoint
CREATE INDEX "checklist_cards_player_idx" ON "checklist_cards" USING btree ("player");--> statement-breakpoint
CREATE INDEX "checklist_cards_search_text_trgm_idx" ON "checklist_cards" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_cards_unique_idx" ON "checklist_cards" USING btree ("product","subset","card_number","player");
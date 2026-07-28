-- Required for the GIN trigram index on cards.search_text (fuzzy/substring
-- card-name search, per .claude/rules/technical-defaults.md "Search").
-- drizzle-kit does not manage extensions — added by hand, reviewed here.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."buy_signal" AS ENUM('good-buy', 'fair', 'walk-away');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('in-stock', 'listed', 'sold');--> statement-breakpoint
CREATE TYPE "public"."condition" AS ENUM('Mint', 'Excellent', 'Good', 'Poor');--> statement-breakpoint
CREATE TYPE "public"."ebay_listing_status" AS ENUM('draft', 'active', 'sold', 'ended-unsold');--> statement-breakpoint
CREATE TYPE "public"."grader" AS ENUM('PSA', 'BGS', 'SGC', 'None');--> statement-breakpoint
CREATE TYPE "public"."sale_platform" AS ENUM('eBay', 'other');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('NFL', 'NBA', 'UFC', 'Soccer');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sport" "sport" NOT NULL,
	"league" text,
	"player" text NOT NULL,
	"team" text NOT NULL,
	"year" text NOT NULL,
	"manufacturer" text NOT NULL,
	"product" text NOT NULL,
	"card_number" text NOT NULL,
	"parallel_name" text,
	"print_run" integer,
	"is_auto" boolean DEFAULT false NOT NULL,
	"is_rookie" boolean DEFAULT false NOT NULL,
	"condition" "condition" NOT NULL,
	"grade" numeric,
	"grader" "grader",
	"photos" text[] DEFAULT '{}'::text[] NOT NULL,
	"acquisition_price" numeric DEFAULT '0' NOT NULL,
	"acquisition_date" date NOT NULL,
	"status" "card_status" DEFAULT 'in-stock' NOT NULL,
	"estimated_value" numeric,
	"value_estimate_detail" jsonb,
	"notes" text,
	"version" integer DEFAULT 0 NOT NULL,
	"search_text" text GENERATED ALWAYS AS (lower(coalesce(player, '') || ' ' || coalesce(team, '') || ' ' || coalesce(manufacturer, '') || ' ' || coalesce(product, '') || ' ' || coalesce(parallel_name, '') || ' ' || coalesce(card_number, '') || ' ' || coalesce(year, ''))) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ebay_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"ebay_listing_id" text,
	"ebay_offer_id" text,
	"title" text NOT NULL,
	"start_price" numeric,
	"buy_now_price" numeric,
	"status" "ebay_listing_status" DEFAULT 'draft' NOT NULL,
	"listed_date" date,
	"ended_date" date,
	"views" integer,
	"watchers" integer,
	"last_synced" timestamp with time zone,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"sport" "sport" NOT NULL,
	"league" text,
	"player" text NOT NULL,
	"team" text NOT NULL,
	"year" text NOT NULL,
	"manufacturer" text NOT NULL,
	"product" text NOT NULL,
	"card_number" text NOT NULL,
	"parallel_name" text,
	"print_run" integer,
	"is_auto" boolean DEFAULT false NOT NULL,
	"is_rookie" boolean DEFAULT false NOT NULL,
	"condition" "condition" NOT NULL,
	"grade" numeric,
	"grader" "grader",
	"estimated_value" numeric,
	"value_estimate_detail" jsonb,
	"looked_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"asking_price" numeric,
	"buy_signal" "buy_signal",
	"converted_card_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"ebay_listing_id" uuid,
	"sale_price" numeric NOT NULL,
	"sale_date" date NOT NULL,
	"platform" "sale_platform" NOT NULL,
	"fees" numeric,
	"shipping_cost" numeric,
	"net_profit" numeric NOT NULL,
	"buyer_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"name" text,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ebay_listings" ADD CONSTRAINT "ebay_listings_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookups" ADD CONSTRAINT "lookups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookups" ADD CONSTRAINT "lookups_converted_card_id_cards_id_fk" FOREIGN KEY ("converted_card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_ebay_listing_id_ebay_listings_id_fk" FOREIGN KEY ("ebay_listing_id") REFERENCES "public"."ebay_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_user_id_status_idx" ON "cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "cards_user_id_player_idx" ON "cards" USING btree ("user_id","player");--> statement-breakpoint
CREATE INDEX "cards_user_id_sport_idx" ON "cards" USING btree ("user_id","sport");--> statement-breakpoint
CREATE INDEX "cards_search_text_trgm_idx" ON "cards" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "ebay_listings_card_id_idx" ON "ebay_listings" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "lookups_user_id_looked_up_at_idx" ON "lookups" USING btree ("user_id","looked_up_at");--> statement-breakpoint
CREATE INDEX "sales_card_id_idx" ON "sales" USING btree ("card_id");
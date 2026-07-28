CREATE TABLE "value_estimate_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
	"is_auto" boolean NOT NULL,
	"is_rookie" boolean NOT NULL,
	"condition" "condition" NOT NULL,
	"grade" numeric,
	"grader" "grader",
	"estimate_detail" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "value_estimate_cache_lookup_idx" ON "value_estimate_cache" USING btree ("sport","player","year","manufacturer","product","card_number");
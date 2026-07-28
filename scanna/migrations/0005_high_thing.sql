ALTER TABLE "cards" ALTER COLUMN "print_run" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "checklist_cards" ALTER COLUMN "print_run" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "lookups" ALTER COLUMN "print_run" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "value_estimate_cache" ALTER COLUMN "print_run" SET DATA TYPE text;
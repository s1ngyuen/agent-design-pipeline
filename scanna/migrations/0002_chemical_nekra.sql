CREATE TABLE "ebay_oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "ebay_oauth_states_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
ALTER TABLE "ebay_oauth_states" ADD CONSTRAINT "ebay_oauth_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
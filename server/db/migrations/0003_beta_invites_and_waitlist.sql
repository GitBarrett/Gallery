CREATE TABLE "beta_invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email_hmac" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "beta_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" text NOT NULL,
	"locale" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entries_locale_check" CHECK ("waitlist_entries"."locale" in ('en', 'fr'))
);
--> statement-breakpoint
ALTER TABLE "beta_invites" ADD CONSTRAINT "beta_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "beta_invites_invited_by_idx" ON "beta_invites" USING btree ("invited_by");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_email_unique" ON "waitlist_entries" USING btree (lower("email"));
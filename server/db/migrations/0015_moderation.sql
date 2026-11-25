CREATE TABLE "moderation_decisions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"source" text NOT NULL,
	"moderator_id" uuid,
	"reason" text,
	"scores" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_decisions_target_check" CHECK ("moderation_decisions"."target_type" in ('photo')),
	CONSTRAINT "moderation_decisions_decision_check" CHECK ("moderation_decisions"."decision" in ('published', 'pending_review', 'rejected')),
	CONSTRAINT "moderation_decisions_source_check" CHECK ("moderation_decisions"."source" in ('auto', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "moderation_score" real;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "moderation_decisions" ADD CONSTRAINT "moderation_decisions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_decisions_auto_idx" ON "moderation_decisions" USING btree ("target_type","target_id") WHERE "moderation_decisions"."source" = 'auto';--> statement-breakpoint
CREATE INDEX "moderation_decisions_target_idx" ON "moderation_decisions" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "moderation_decisions_moderator_idx" ON "moderation_decisions" USING btree ("moderator_id");--> statement-breakpoint
CREATE INDEX "moderation_decisions_created_idx" ON "moderation_decisions" USING btree ("created_at");
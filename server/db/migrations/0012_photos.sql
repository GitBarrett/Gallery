CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"game_version_id" uuid,
	"title" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_status_check" CHECK ("photos"."status" in ('processing', 'failed', 'pending_review', 'published', 'rejected', 'hidden')),
	CONSTRAINT "photos_uploaded_check" CHECK ("photos"."uploaded_at" is null or ("photos"."title" is not null and "photos"."game_version_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_game_version_id_game_versions_id_fk" FOREIGN KEY ("game_version_id") REFERENCES "public"."game_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_user_idx" ON "photos" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "photos_game_version_idx" ON "photos" USING btree ("game_version_id");--> statement-breakpoint
CREATE INDEX "photos_incomplete_idx" ON "photos" USING btree ("created_at") WHERE "photos"."uploaded_at" is null;
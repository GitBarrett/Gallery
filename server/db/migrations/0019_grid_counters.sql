ALTER TABLE "photos" ADD COLUMN "likes_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "downloads_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "photos_grid_idx" ON "photos" USING btree ("game_version_id","published_at" DESC NULLS LAST,"id" DESC NULLS LAST) WHERE "photos"."status" = 'published';
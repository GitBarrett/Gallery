CREATE TABLE "photo_metadata" (
	"photo_id" uuid PRIMARY KEY NOT NULL,
	"zone_id" uuid,
	"zone_custom" text,
	"in_game_time" text,
	"graphics_settings" text,
	"character_name" text,
	"caption" text
);
--> statement-breakpoint
CREATE TABLE "photo_tags" (
	"photo_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "photo_tags_photo_id_tag_id_pk" PRIMARY KEY("photo_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "alt_text" text;--> statement-breakpoint
ALTER TABLE "photo_metadata" ADD CONSTRAINT "photo_metadata_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_metadata" ADD CONSTRAINT "photo_metadata_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_tags" ADD CONSTRAINT "photo_tags_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_tags" ADD CONSTRAINT "photo_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_metadata_zone_idx" ON "photo_metadata" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "photo_metadata_zone_custom_idx" ON "photo_metadata" USING btree ("zone_custom") WHERE "photo_metadata"."zone_custom" is not null;--> statement-breakpoint
CREATE INDEX "photo_tags_tag_idx" ON "photo_tags" USING btree ("tag_id");
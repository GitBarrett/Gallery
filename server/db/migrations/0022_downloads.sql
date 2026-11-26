CREATE TABLE "downloads" (
	"user_id" uuid NOT NULL,
	"photo_id" uuid NOT NULL,
	"day" date NOT NULL,
	CONSTRAINT "downloads_user_id_photo_id_day_pk" PRIMARY KEY("user_id","photo_id","day")
);
--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "downloads" ADD CONSTRAINT "downloads_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "downloads_photo_idx" ON "downloads" USING btree ("photo_id");--> statement-breakpoint
CREATE INDEX "downloads_day_idx" ON "downloads" USING btree ("day");
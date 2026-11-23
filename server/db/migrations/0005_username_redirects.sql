CREATE TABLE "username_redirects" (
	"old_username" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "username_redirects" ADD CONSTRAINT "username_redirects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "username_redirects_user_idx" ON "username_redirects" USING btree ("user_id");
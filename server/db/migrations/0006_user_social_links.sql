CREATE TABLE "user_social_links" (
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_social_links_user_id_platform_pk" PRIMARY KEY("user_id","platform"),
	CONSTRAINT "user_social_links_platform_check" CHECK ("user_social_links"."platform" in ('twitch', 'youtube', 'x', 'bluesky', 'instagram', 'tiktok', 'reddit', 'discord', 'website'))
);
--> statement-breakpoint
ALTER TABLE "user_social_links" ADD CONSTRAINT "user_social_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
-- Trusted extensions (the database owner creates them, no superuser): typo tolerant and accent-free search of the zones
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "unaccent";
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" text NOT NULL,
	"name_en" text NOT NULL,
	"name_fr" text NOT NULL,
	"aliases" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zones_slug_unique" UNIQUE("slug"),
	CONSTRAINT "zones_status_check" CHECK ("zones"."status" in ('active', 'pending'))
);

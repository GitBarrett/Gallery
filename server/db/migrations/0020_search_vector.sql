-- ADR-007: unaccent is only STABLE (its dictionary may change); this wrapper names the dictionary, so it may be
-- declared IMMUTABLE and used by the generated search columns.
CREATE OR REPLACE FUNCTION public.f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;--> statement-breakpoint
ALTER TABLE "photo_metadata" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', public.f_unaccent(lower(coalesce(character_name, '')))), 'B') || setweight(to_tsvector('simple', public.f_unaccent(lower(coalesce(zone_custom, '')))), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', public.f_unaccent(lower(coalesce(title, '')))), 'A') || setweight(to_tsvector('simple', public.f_unaccent(lower(coalesce(description, '')))), 'C')) STORED;--> statement-breakpoint
CREATE INDEX "photo_metadata_search_idx" ON "photo_metadata" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "photos_search_idx" ON "photos" USING gin ("search_vector");
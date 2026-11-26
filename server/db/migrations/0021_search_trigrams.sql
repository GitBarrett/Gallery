CREATE INDEX "tags_slug_trgm_idx" ON "tags" USING gin ("slug" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "zones_name_en_trgm_idx" ON "zones" USING gin (public.f_unaccent(lower("name_en")) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "zones_name_fr_trgm_idx" ON "zones" USING gin (public.f_unaccent(lower("name_fr")) gin_trgm_ops);
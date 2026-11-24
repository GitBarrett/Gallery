-- Game versions of the catalogue at launch (02-specs-fonctionnelles.md § Galerie, Q65): reference data, kept by
-- emptyData (scripts/database.mjs). Run again, it changes nothing.
INSERT INTO "game_versions" ("slug", "name_en", "name_fr", "position") VALUES
  ('wow-forever', 'WoW Forever', 'WoW Forever', 1),
  ('retail', 'Retail', 'Retail', 2),
  ('classic-era', 'Classic Era', 'Classic Era', 3),
  ('classic-progression', 'Classic progression', 'Classic progression', 4),
  ('other', 'Other', 'Autre', 5)
ON CONFLICT ("slug") DO NOTHING;

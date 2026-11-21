-- Rôle applicatif (08-securite.md, moindre privilège) : le Worker se connecte avec un rôle membre de app_rw, jamais
-- avec le propriétaire, réservé aux migrations. audit_log est en insertion seule pour l'application.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_rw;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rw;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM app_rw;
--> statement-breakpoint
-- Seed de base, sûr en production : les dons (v1.1) restent désactivés
INSERT INTO site_settings (key, value) VALUES ('features.donations', 'false') ON CONFLICT (key) DO NOTHING;

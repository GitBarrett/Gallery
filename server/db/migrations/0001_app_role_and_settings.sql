-- Application role (08-securite.md, least privilege): the Worker connects with a role member of app_rw, never
-- as the owner, kept for migrations. audit_log is insert-only for the application.
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
-- Base seed, safe in production: donations (v1.1) stay disabled
INSERT INTO site_settings (key, value) VALUES ('features.donations', 'false') ON CONFLICT (key) DO NOTHING;

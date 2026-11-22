# CLAUDE.md — Legendary Shots

Site communautaire de galeries de captures d'écran World of Warcraft (focus WoW Forever), PWA responsive EN/FR (anglais par défaut), financé par la publicité.

## Règles de travail (spec-driven)

1. Avant toute tâche, lire `docs/06-plan-de-taches.md` (règles d'exécution, DoR, DoD) et prendre **la première tâche non cochée** dont les dépendances sont cochées.
2. Lire les stories et critères référencés (`docs/04-user-stories.md`), puis les sections concernées de `docs/03-architecture.md`, `docs/08-securite.md` et `docs/10-clean-architecture.md`.
3. **TDD** : écrire d'abord les tests des critères d'acceptation, nommés avec leur identifiant (`US-30.2 …`), selon `docs/11-strategie-de-tests.md` ; les voir échouer, puis coder.
4. Une tâche = une branche `feat/T-xx-slug` = une pull request (≈ 400 lignes applicatives max). Ne jamais mélanger plusieurs tâches.
5. Avant d'ouvrir la PR : en local, `pnpm lint`, `pnpm typecheck` et les tests touchés seulement (fichiers ciblés ou `vitest related`) ; le job `checks` de la CI (`pnpm check` complet : architecture, couverture, traçabilité) fait foi et doit être vert avant la fusion. Checklist sécurité (`08-securite.md` § 10) cochée dans la description, tâche cochée dans le plan.
6. Toute décision non couverte par les specs : ne pas improviser. Ajouter une question dans `docs/09-questions-ouvertes.md`, appliquer l'option la plus simple et réversible, et le signaler dans la PR.
7. Toute décision d'architecture nouvelle : créer un ADR dans `docs/adr/`.
8. Phase **T-00 (prototypes)** avant T-02 : scripts jetables dans `prototypes/`, aucun code applicatif, résultats consignés en ADR.
9. Tâche marquée **action humaine** : préparer tout ce qui est possible, documenter les étapes pour Adrien dans la PR, et s'arrêter.
10. Code non structurel : solution la plus simple qui marche (pas d'abstraction, de wrapper ni de dépendance pour quelques lignes ; supprimer plutôt qu'ajouter). Ne déroge jamais aux règles 3 à 9, à l'architecture ni au découpage en tâches. Un raccourci connu porte un commentaire `shortcut: <limite>, <quand monter en charge>`.
11. Maquettes `docs/design/*.dc.html` = référence visuelle uniquement : ne jamais copier leur HTML ni leurs styles en ligne. Reconstruire avec les composants `app/components/ui` et les tokens CSS (ADR-014). Elles viennent du canevas « Legendary Shots – Design » (artifact Claude Design, fichiers `project/*.dc.html`) : au début de chaque tâche front, les relire depuis l'artifact, comparer aux copies du dépôt et committer celles qui ont changé (`docs: …`) avant de coder.

## Stack (non négociable sans ADR)

- Nuxt 3+ (Vue 3, TypeScript strict), full-stack, monolithe modulaire en Clean Architecture. Pas de front découplé, pas de microservices.
- Déploiement : Cloudflare Workers (preset Nitro `cloudflare_module`), Cron Triggers, Queues (+ DLQ), Workers Rate Limiting.
- Base : PostgreSQL serverless Neon via Cloudflare Hyperdrive en production (cache Hyperdrive désactivé ; une configuration Hyperdrive par preview, ADR-016). ORM : Drizzle. Clés UUID v7.
- Images : Cloudflare R2 **privé** (originaux + variantes) ; variantes WebP et JPEG générées **une seule fois** au traitement par le binding Cloudflare Images (ADR-012), servies par la route `/img/{id}/{w}` sans transformation à l'affichage. Originaux jamais publics.
- Previews : une preview complète par PR (Worker, Queues, branche Neon, préfixe R2), derrière Cloudflare Access (ADR-013).
- Auth : nuxt-auth-utils (cookie scellé + table `sessions`), OAuth Google (state + PKCE) et Battle.net (state), email + mot de passe (Argon2id), TOTP pour le staff.
- CSS : natif (ADR-014) — `tokens.css` + `base.css` + `<style scoped>` en `var(--…)` ; aucun framework CSS, aucun style inline statique ; Stylelint.
- Sécurité HTTP : nuxt-security (CSP à nonce, en-têtes). Pas de décodage d'image dans le Worker (ADR-011) : binding Images uniquement. Limites strictes et fenêtres longues : `rate_limit_counters` (le binding Rate Limiting est approximatif, par emplacement).
- Emails : Resend. Modération : Sightengine. Analytics : PostHog (EU) + Cloudflare Web Analytics. Anti-bot : Turnstile. Erreurs : Sentry.
- i18n : @nuxtjs/i18n (en par défaut, fr). PWA : @vite-pwa/nuxt (mode injectManifest, ADR-008). Polices auto-hébergées : @nuxt/fonts.
- Mobile d'abord : toute page doit fonctionner à 360 px de large.
- Tests : Vitest (+ @nuxt/test-utils), Playwright, axe-core, Lighthouse CI. Contrôle d'architecture : dependency-cruiser. CI : GitHub Actions.

## Structure (détail et règles : `docs/10-clean-architecture.md`)

```
shared/
  contracts/      schémas Zod API partagés client/serveur
  domain/         règles pures partagées (qualité, validation de fichier…)
server/
  modules/<m>/    domain/ · application/ (use cases, ports) · infrastructure/ (adaptateurs) · interface/ (mappers, consommateurs, cron) · index.ts
  api/            routes Nitro fines (≈ 20 lignes, aucune règle métier)
  platform/       config, container, logger, erreurs HTTP, contexte d'auth, rate limit, sécurité
  db/             schéma Drizzle, migrations, seed
app/
  pages/          pages fines
  features/<f>/   composables et composants d'une fonctionnalité
  components/ui/  design system (présentation pure)
  composables/    transverses
  services/api/   client API typé (seul appelant de /api)
i18n/             en.json, fr.json
tests/
  fakes/ builders/ contracts/ fixtures/ api/ e2e/
docs/             specs (ce dossier fait foi)
```

## Conventions

- Dépendances : `interface → application → domain` ; `infrastructure` implémente les ports ; un module n'importe que l'`index.ts` d'un autre. Vérifié par dependency-cruiser.
- Validation Zod stricte de toute entrée (HTTP, messages, réponses fournisseurs) ; erreurs au format commun `{ error: { code, message, correlationId } }`.
- Autorisation déclarée dans chaque use case (refus par défaut) ; ressources privées d'autrui → 404.
- Aucun `v-html`, aucun Markdown utilisateur interprété ; aucune donnée personnelle dans les logs.
- Aucun secret dans le code : secrets Cloudflare, `.env.example` maintenu, gitleaks.
- Consommateurs de Queue et crons idempotents.
- Textes UI uniquement via i18n (EN et FR).
- Accessibilité : contrastes AA, navigation clavier, `alt` obligatoire, cibles tactiles ≥ 44 px.
- Commits : Conventional Commits. Migrations rétrocompatibles (expand → migrate → contract).

## Commandes

- `pnpm dev` — dev local (wrangler / Miniflare, fournisseurs factices)
- `pnpm check` — lint + typecheck + `arch` + `test:coverage` (unitaires, composants et intégration, base dans `.env.test` en local) + `test:trace`
- `pnpm test` — Vitest unitaires et composants
- `pnpm test:int` — Vitest intégration (Postgres local)
- `pnpm test:e2e` — Playwright (desktop, iPhone 14, Pixel 7)
- `pnpm test:trace` — vérifie que chaque AC [MVP] a un test
- `pnpm arch` — dependency-cruiser
- `pnpm storybook` — design system et playbook (ADR-019) ; publiés sous `/storybook/` en production et sur les previews
- `pnpm lint` (ESLint + Stylelint) / `pnpm typecheck`
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:seed` — Drizzle

## Documents

| Fichier | Contenu |
|---|---|
| docs/01-vision.md | Vision, cible, benchmark |
| docs/02-specs-fonctionnelles.md | Règles fonctionnelles détaillées |
| docs/03-architecture.md | Architecture technique : modules, pipeline image, données, API, Queues/cron, config, environnements, observabilité, sauvegarde, PWA, SEO |
| docs/04-user-stories.md | Epics, stories et critères d'acceptation (font foi pour le comportement) |
| docs/05-finops.md | Budget par tranche d'utilisateurs |
| docs/06-plan-de-taches.md | Plan de tâches ordonné, DoR, DoD (à exécuter) |
| docs/07-design.md | Design, identité visuelle, responsive, contraste ; maquettes dans `docs/design/` ; composants et playbook dans Storybook (`/storybook/`, ADR-019) |
| docs/08-securite.md | Sécurité de bout en bout, matrice d'autorisation (fait foi pour la sécurité) |
| docs/09-questions-ouvertes.md | Points à trancher |
| docs/10-clean-architecture.md | Couches, règles de dépendance, front et back, contrôles |
| docs/11-strategie-de-tests.md | Pyramide, couverture, fakes, E2E, CI |
| docs/adr/ | Décisions d'architecture |
| docs/legal/ | Brouillons des pages légales |
| docs/seed/ | Données d'initialisation (zones) |

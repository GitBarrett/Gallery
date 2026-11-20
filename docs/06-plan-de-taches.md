# 06 — Plan de tâches

## Règles d'exécution
1. Prendre **la première tâche non cochée** dont toutes les dépendances sont cochées. Ne jamais anticiper une tâche suivante.
2. **Definition of Ready** (vérifiée avant de coder) : stories et AC référencés lus ; sections d'architecture, de sécurité et de Clean Architecture concernées lues ; questions bloquantes absentes de `09-questions-ouvertes.md` (sinon : appliquer l'option par défaut et le signaler).
3. **TDD** : écrire d'abord les tests listés dans la tâche (identifiants `US-xx.n`), les voir échouer, puis coder.
4. **Une tâche = une branche `feat/T-xx-slug` = une PR**, ≈ 400 lignes de code applicatif au plus (hors tests et migrations). Si c'est plus gros, découper et le noter dans la PR.
5. **Definition of Done** (toutes obligatoires) :
   - tests listés écrits et verts ; couverture et `pnpm test:trace` OK (`11-strategie-de-tests.md`) ;
   - lint, typecheck, dependency-cruiser, gitleaks OK ;
   - checklist sécurité `08-securite.md` § 10 cochée dans la PR ;
   - migrations rétrocompatibles (expand → migrate → contract) et seed mis à jour ;
   - textes en i18n EN et FR ; écrans conformes aux maquettes `docs/design/` en desktop et à 360 px — pour un écran sans maquette (réglages, back-office, cookies, 404/500), composer uniquement avec le design system et joindre à la PR des captures desktop et mobile pour validation ;
   - accessibilité : navigation clavier et axe-core sans violation sérieuse sur les écrans touchés (US-75) ;
   - preview déployée, E2E et Lighthouse verts ;
   - si la tâche ajoute des données personnelles : cascade de suppression (US-09) et rétention mises à jour ;
   - tâche cochée ici, écarts et décisions résumés dans la PR, ADR si nouvelle décision d'architecture.
6. Toute fonctionnalité incomplète en production est masquée par un flag (`site_settings.features.*`).
7. **Action humaine** : certaines tâches demandent une action d'Adrien (comptes, domaines, secrets). Préparer tout le reste, documenter la marche à suivre dans la PR et s'arrêter.

Légende des tests : **U** unitaire, **I** intégration (API/base), **E** E2E Playwright.

---

## Phase T-00 — Prototypes (avant toute infrastructure)

Scripts jetables dans `prototypes/` (hors application, jamais fusionnés dans `main`). Chaque prototype a un critère de réussite et un repli ; le résultat est consigné dans `docs/adr/` et dans la matrice d'architecture (`03-architecture.md`). Pas de code applicatif dans cette phase.

- [ ] **T-00a Mémoire Worker et 8K** : décoder une capture 8K (7680×4320) dans un Worker n'est pas permis (ADR-011) ; mesurer la mémoire du chemin binding Images avec une image 33,2 Mpx. Réussite : aucune erreur mémoire sur 20 Mo. Repli : limite sous 20 Mpx côté serveur et conversion navigateur obligatoire au-delà.
- [ ] **T-00b Binding Images 33,2 Mpx** : confirmer les limites exactes du binding Images (dimension, taille d'entrée, nombre de transformations facturées). Réussite : les 4 variantes et la vignette 64 px sont produites pour un JPEG 8K. Repli : réduire les largeurs de variantes ou passer à deux étapes.
- [ ] **T-00c Traitement parallèle** : traiter trois PNG 5120×2160 en parallèle, mesurer le temps total et les erreurs. Réussite : moins de 30 s par capture et aucune erreur. Repli : file séquentielle par capture.
- [ ] **T-00d Hachage de mot de passe** : mesurer Argon2id et scrypt (`@noble/hashes`) sur Workers, temps de calcul et mémoire (Q5). Réussite : moins de 500 ms par hachage. Repli : scrypt avec paramètres documentés.
- [ ] **T-00e Latence Worker vers Neon** : mesurer la latence d'une requête simple via Hyperdrive et Smart Placement, depuis Paris. Réussite : médiane sous 50 ms. Repli : placer le Worker dans la région de la base, ou accepter une latence plus haute documentée.
- [ ] **T-00f Files et crons Nitro** : valider les hooks `cloudflare:queue` et `cloudflare:scheduled` sur un Worker minimal (T-03 en reprend le résultat). Réussite : un message et un cron traités. Repli : consommateur Queue en Worker séparé.
- [ ] **T-00g Preview par PR** : créer et supprimer un Worker de preview avec sa Queue, sa branche Neon et son préfixe R2. Réussite : création en moins de 5 min, suppression complète. Repli : preview partielle (Worker sans Queue) documentée.
- [ ] **T-00h Comparaison d'hébergement** : comparer l'option A (tout Cloudflare) et l'option B (Vercel pour l'application, stockage des images ailleurs) avec les résultats T-00a à T-00g et le chiffrage aux prix actuels. Pondérations validées le 18/11/2026 : coût 25 %, simplicité 20 %, performance 15 %, sécurité et exploitation 15 %, portabilité 15 %, previews 10 %. Réussite : décision consignée en ADR. AWS écarté le 18/11/2026 (configuration des droits et permissions jugée trop complexe).

**Dépendances** : T-02 et T-03 dépendent de T-00h.

## Phase 0 — Fondations (squelette déployé de bout en bout)

- [ ] **T-01 Dépôt et outillage**
  Nuxt 3+ TypeScript strict, pnpm, arborescence de `10-clean-architecture.md` (`shared/`, `server/modules`, `server/platform`, `app/features`, `app/components/ui`…), ESLint (`vue/no-v-html`, `no-explicit-any`), Prettier, dependency-cruiser avec les règles du § 7, Vitest (projets unit / component / integration, seuils de couverture), Playwright (projets desktop, iPhone 14, Pixel 7), gitleaks en pre-commit, script `test:trace`, `.env.example`, Conventional Commits (commitlint).
  Tests : U (test d'architecture qui échoue sur un import interdit d'exemple, puis exemple retiré).

- [ ] **T-02 Plateforme serveur** (dép. T-01, T-00h)
  `server/platform` : config validée par Zod au démarrage, logger JSON sans données personnelles, type `Result`, erreurs métier → HTTP (format commun), identifiant de corrélation, container de composition, ports `Clock` et `IdGenerator` (UUID v7), middleware en-têtes de sécurité + CSP à nonce, vérification d'origine des mutations, `GET /api/health`, Sentry.
  Tests : U (mapping des erreurs, config), I (en-têtes présents, mutation cross-origin refusée, format d'erreur, health).

- [ ] **T-03 Infrastructure et déploiement** (dép. T-02, T-00h) — **action humaine** : comptes Cloudflare, Neon, GitHub, Sentry ; domaine (Q3).
  `wrangler.toml` (bindings R2 privé, Queues + DLQ, Hyperdrive, Images, Rate Limiting, Cron Triggers), branchement des hooks Nitro `cloudflare:queue` et `cloudflare:scheduled` (preuve par un consommateur et un cron de test), environnements preview selon **ADR-013** (workflows `preview-deploy` et `preview-cleanup` : Worker `ls-pr-{n}`, Queues et DLQ suffixées, branche Neon en connexion directe, préfixe du bucket `ls-preview`, `noindex`, **Cloudflare Access** « tous les Workers » avec bypass du seul Worker de production, jeton de service pour la CI) et production (déploiement depuis `main` après CI verte), politiques CORS des buckets R2 (production et preview), secrets documentés (Worker et CI), WAF et règle de limitation selon le plan de zone (`08-securite.md` § 2), beacon Web Analytics ajouté par Nuxt (injection automatique désactivée), adaptateurs factices des fournisseurs et routes `/__test/*` uniquement dans les builds preview (contrôle au démarrage en production).
  DoD : la preview d'une PR répond sur `/api/health` (base et R2 OK) derrière Access ; un message de Queue et un cron de test sont traités **sur la preview** ; deux PR ouvertes en parallèle ne partagent ni Queue ni base ; la fermeture d'une PR supprime toutes ses ressources ; un PUT navigateur vers une URL présignée du bucket de preview passe le CORS ; l'artefact de production ne contient aucune route `/__test`.

- [ ] **T-04 CI complète** (dép. T-03)
  Pipeline de `11-strategie-de-tests.md` § 7 : lint, typecheck, unitaires, intégration (Postgres), migrations, preview, Playwright smoke, Lighthouse CI, CodeQL, audit, gitleaks, smoke production + rollback ; Dependabot ; protection de `main`.
  Tests : la CI elle-même (PR de démonstration qui échoue sur chaque garde).

- [ ] **T-05 Base de données** (dép. T-03)
  Drizzle, conventions (UUID v7, `timestamptz`, index), tables transverses `outbox`, `processed_messages`, `site_settings`, `audit_log` (rôle base sans UPDATE/DELETE), `rate_limit_counters`, `UnitOfWork`, relais outbox → Queues, port `RateLimiter` (adaptateurs binding Workers et compteurs en base, `08-securite.md` § 8), seed de base, transaction de test annulée.
  Tests : I (migration sur base vierge, relais outbox, idempotence `processed_messages`, compteur exact sur fenêtre d'une heure), contrat `UnitOfWork` et `RateLimiter`.

- [ ] **T-06 Design system** (dép. T-01)
  CSS natif selon ADR-014 : `app/assets/css/tokens.css` (tokens de `07-design.md` : couleurs, typographies auto-hébergées via `@nuxt/fonts`, espacements), `base.css`, Stylelint (valeurs en dur interdites hors tokens) ; maquettes `docs/design/` en référence visuelle seulement. Composants `app/components/ui` : Button, Input, Card, Modal, BottomSheet, Toast, EmptyState, ActionIcon, QualityBadge, ItemTooltip, QuestMarker, ImageScrim, WowImage (sans route `/img` : prop `src`), LogoMark ; `shared/domain/quality.ts` (`qualityFromLikes(likes, thresholds)` — seuils passés en paramètre, jamais en dur).
  Tests : U (qualité), composants (rendu, accessibilité axe, contraste avec fixtures blanche et noire pour ImageScrim), Stylelint qui échoue sur une couleur en dur d'exemple.

- [ ] **T-07 Socle front** (dép. T-06)
  Layout, header partagé (une ligne ≥ 1180 px, barre d'onglets < 768 px, entrées pilotées par les flags : composition MVP de `07-design.md` § Header), footer, i18n EN/FR (`/` et `/fr/`, détection, sélecteur, contrôle de complétude des clés), safe areas, lien d'évitement, focus visible, gestion du mouvement réduit, pages 404/500 avec identifiant de corrélation, client API typé `app/services/api` + gestion d'erreur commune.
  Stories : US-62, US-67 (structure), US-69, US-75.1, US-75.4. Tests : U (complétude i18n), E (US-62.1–3, US-67.1, US-67.5–6, US-69.1–2, US-75.1).

- [ ] **T-08 Réglages du site et flags** (dép. T-05)
  Module `settings` : lecture typée de `site_settings` (seuils de qualité, de modération, d'affichage, hero, editor's pick, flags), cache 60 s, valeurs par défaut de lancement (seuils 3/15/50/150, `moderation.reportsToHide` = 3, `features.inviteOnly` = true jusqu'à l'ouverture), réglage `legal` (version des Terms en vigueur et à venir), exposition publique en lecture des valeurs non sensibles (`GET /api/settings/public`).
  Stories : US-56 (lecture), US-71.5. Tests : U (validation des réglages US-56.2), I.

- [ ] **T-09 PWA** (dép. T-07)
  @vite-pwa/nuxt `injectManifest` (ADR-008), manifest et icônes depuis `Logo.dc.html` (raccourcis MVP Upload, Search, Notifications ; pas de `share_target` avant T-66), service worker (stratégies de `03-architecture.md` § PWA, sans les routes `/img` qui seront ajoutées en T-25), `/offline`, bandeau hors ligne, toast de mise à jour, invitation à l'installation.
  Stories : US-63, US-64.2–3, US-65. Tests : E (Chromium avec service worker).

- [ ] **T-10 Consentement, analytics et pages légales** (dép. T-07)
  Panneau cookies conforme à `docs/legal/cookies.md`, chargement conditionnel de PostHog EU, Cloudflare Web Analytics, pages `/legal`, `/terms`, `/privacy`, `/cookies` depuis `docs/legal/*.md`.
  Stories : US-61, US-72 (mécanique), US-74.1. Tests : E (aucun appel PostHog ni cookie avant consentement, retrait).

## Phase 1 — Identité

- [ ] **T-11 Inscription et vérification d'email** (dép. T-05, T-07, T-08, T-10)
  Module `identity` (domain, application, infrastructure), table `users`, `sessions`, `email_tokens`, `beta_invites`, `waitlist_entries`, Argon2id/scrypt (Q5), HIBP, Turnstile, acceptation des Terms (15 ans), Mailer (Resend + fake), politique « email vérifié requis », mode invitation (inscription refusée sans invitation, liste d'attente).
  Stories : US-01, US-08, US-56.4. Tests : U, I, E (US-01.1–7, US-08.1–2, US-56.4).

- [ ] **T-12 Connexion, déconnexion, sessions** (dép. T-11)
  Sessions en base vérifiées à chaque requête, rotation d'identifiant, verrouillage progressif, révocation, redirection sûre, `requireContext`.
  Stories : US-03, US-64.4 (vidage des caches du service worker à la déconnexion). Tests : U, I, E (US-03.1–6, US-64.4).

- [ ] **T-13 Mot de passe oublié** (dép. T-12)
  Stories : US-04. Tests : U, I, E.

- [ ] **T-14 OAuth Google** (dép. T-12) — **action humaine** : client OAuth Google.
  State + PKCE, règles de liaison, bouton conforme à la charte Google (logo officiel).
  Stories : US-02.1–5. Tests : U, I (fournisseur factice), E.

- [ ] **T-15 OAuth Battle.net** (dép. T-14) — **action humaine** : client Battle.net.
  Hôte global `oauth.battle.net` (pas de choix de région), `state` sans PKCE, absence d'email, logo officiel (Q7).
  Stories : US-02.6. Tests : I, E.

- [ ] **T-16 Pseudo et profil public** (dép. T-12)
  Pseudos réservés, changement limité, redirections, page `/u/{pseudo}` (captures vides pour l'instant : état vide).
  Stories : US-05. Tests : U, I, E.

- [ ] **T-17 Réglages du compte** (dép. T-16)
  `/settings` : bio, langue, email, mot de passe, comptes liés (l'avatar arrive en T-28, après la modération).
  Stories : US-07.1–4. Tests : U, I, E.

- [ ] **T-18 Rôles, MFA staff, autorisation, audit** (dép. T-12)
  Politiques d'autorisation déclaratives, harnais de **matrice d'autorisation** générée depuis l'inventaire des routes (`08-securite.md` annexe B), TOTP staff obligatoire après tout mode de connexion, codes de secours, `sessions.mfa_verified_at` et `reauth_at`, promotion/rétrogradation, commandes `pnpm admin:promote` (premier admin) et `pnpm admin:reset-mfa`, `audit_log`, squelette `/admin` (accès MFA).
  Stories : US-55, US-58.1. Tests : U, I (matrice), E. **Action humaine** : exécuter `admin:promote` en production après le premier déploiement.

## Phase 2 — Catalogue et publication

- [ ] **T-20 Catalogue** (dép. T-05)
  Module `catalog` : versions du jeu (EN/FR, ordre, archivage), dictionnaire des zones (import `docs/seed/zones.csv`, alias, suggestion EN/FR), tags (normalisation, suggestion) ; `pg_trgm`, `unaccent`.
  Stories : US-57.2, US-11.1–2 (API), US-62.4. Tests : U (normalisation), I (suggestion « Hurl », « Stormw », « SW »).

- [ ] **T-21 Demande d'upload** (dép. T-18, T-20)
  Module `media` : `requestUploadUrl` (politiques, quotas, URL présignée bucket privé signée sur taille et type), `completeUpload` (idempotent, contrôle `R2.head` de la taille et du type), nettoyage des orphelins (cron horaire).
  Stories : US-10.1–2, US-10.5–7. Tests : U, I, contrat `ObjectStorage`, E (PUT navigateur réel sur la preview : CORS et CSP).

- [ ] **T-22 Traitement des captures** (dép. T-21)
  Consommateur `photo-process` selon ADR-011 et ADR-012 (aucun décodage d'image complète dans le Worker) : octets magiques, `IMAGES.info()`, suppression des métadonnées au niveau octet (JPEG, PNG, WebP), écriture unique des variantes (PNG 64 temporaire, JPEG 1200, WebP 400/800/1200/2400), luminance, idempotence, retries et DLQ.
  Stories : US-14.1–3, US-14.5–6, US-10.3–4, US-10.8. Tests : U (stripper sur corpus `tests/fixtures/images` et `malicious` : pixels identiques, aucune métadonnée, profil ICC conservé, orientation ≠ 1 refusée ; fixtures JPEG avec ICC Display P3 et APP14 Adobe, PNG avec `iCCP`, WebP `VP8X` avec EXIF), I (double livraison), charge (US-14.5).

- [ ] **T-23 Notifications in-app** (dép. T-12, T-05)
  Module `notifications` : création via événements, regroupement des likes, préférences, cloche (compteur), page « Quest log », purge à 6 mois.
  Stories : US-35, US-07.5. Tests : U (regroupement, préférences), I, E.

- [ ] **T-24 Modération automatique** (dép. T-22, T-23, T-08)
  Port `ModerationProvider` (Sightengine + fake), seuils depuis `site_settings`, retries, historique `moderation_decisions`, notification de l'auteur.
  Stories : US-50. Tests : U (seuils), I (pannes), E (fichier NSFW de fixture refusé).

- [ ] **T-25 Service des images** (dép. T-22, T-06)
  Route `/img/{id}/{w}` et `/img/{id}/og.jpg` (variantes lues dans R2 sans transformation, largeurs fixes, captures publiées uniquement, API Cache, masquage = variantes dans `trash/` + purge par URL via token dédié), aperçu privé `?preview=1` pour l'auteur et les modérateurs, `WowImage` branché sur cette route (`srcset`, `sizes`, dimensions, texte alternatif US-75.3), règles du service worker pour `/img`, page « My captures » avec statuts.
  Stories : US-14.4, US-68.3, US-64.1, US-64.5–6, US-75.3. Tests : I (largeur invalide = 404, capture non publiée = 404 publiquement et 200 pour l'auteur), E.

- [ ] **T-26 Formulaire d'upload** (dép. T-21, T-24, T-25)
  Page `/upload` conforme à la maquette : sélection, validation client (règles `shared/domain`), **conversion dans le navigateur** (TGA → PNG ; au-delà de 20 Mo : WebP sans perte puis JPEG 95 4:4:4 avec avertissement ; Web Worker + encodeurs WebAssembly libwebp et MozJPEG chargés à la demande ; échec mémoire géré), progression et reprise, métadonnées, zone, tags, légende, texte alternatif, point focal, aperçu en direct, case de consentement.
  Stories : US-10 (parcours, dont US-10.9–10), US-11, US-13. Tests : U (choix de la chaîne de conversion), composants, E (JPEG et TGA de bout en bout ; PNG 5K2K de 25 Mo → WebP sans perte ; TGA 8K → JPEG 95 avec avertissement ; aucune violation CSP).

- [ ] **T-27 Modifier et supprimer une capture** (dép. T-26)
  Stories : US-12. Tests : U (propriété), I (IDOR), E.

- [ ] **T-28 Avatar** (dép. T-17, T-24, T-25)
  Upload présigné dédié (2 Mo), recadrage carré, message `avatar-process`, variantes WebP 64/128/256 écrites une fois, modération automatique, ancien avatar conservé jusqu'à validation, route `/avatar/{userId}/{version}/{size}`.
  Stories : US-07.6. Tests : U, I, E.

## Phase 3 — Découverte

- [ ] **T-30 Galerie et PLP** (dép. T-25, T-08)
  Module `gallery` : requêtes de grille par version, filtres, tris, pagination par curseur, état vide « Be the first », infobulle de qualité « ? ».
  Stories : US-20, US-70.5, US-71.1. Tests : U, I (pagination stable), E.

- [ ] **T-31 Page photo (PDP)** (dép. T-30)
  Infobulle façon objet, précédent/suivant et swipe, « More from » avec replis, Open Graph, `ImageObject`.
  Stories : US-25.1, US-67.2–3, US-70.1–2, US-71.2. Tests : I, E.

- [ ] **T-32 Page d'accueil** (dép. T-30, T-08)
  Hero administrable avec voile, « Capture of the week » et ses replis, bandeau de quête (masqué tant que `features.contests` est désactivé).
  Stories : US-24, US-70.4. Tests : U (replis), E.

- [ ] **T-33 Recherche** (dép. T-30, T-20)
  ADR-007 : `search_vector`, dictionnaire des zones, tolérance aux fautes, autocomplétion, page sans résultat.
  Stories : US-21. Tests : U, I (jeu de données de recherche), E.

- [ ] **T-34 Téléchargement HD** (dép. T-31)
  URL présignée 5 min, déduplication du compteur, limites, reprise après connexion.
  Stories : US-23. Tests : U, I, E.

- [ ] **T-35 SEO** (dép. T-31)
  Métadonnées, canonique, `hreflang`, sitemap (cron quotidien), robots, `noindex` des previews, 404/410 des contenus retirés.
  Stories : US-25.2–4. Tests : I, E.

## Phase 4 — Communauté et qualité

- [ ] **T-40 Likes et qualité** (dép. T-31, T-23)
  Like idempotent, interdiction de l'auto-like, limites, recalcul de qualité, notification de palier (une fois par palier).
  Stories : US-30, US-71.4. Tests : U, I (concurrence), E.

- [ ] **T-41 Commentaires** (dép. T-31, T-23)
  Rendu texte, filtre d'insultes (Q8), édition 15 min, suppression, limites.
  Stories : US-31. Tests : U, I, E (dont XSS).

- [ ] **T-42 Partage** (dép. T-31)
  `navigator.share`, menu de repli, événement analytics.
  Stories : US-32, US-72.1. Tests : E.

- [ ] **T-43 Pédagogie de la qualité** (dép. T-40)
  Survol/tap des badges, notification de première capture, progression sur le profil, page `/help/quality`.
  Stories : US-71.2–3. Tests : U, E.

- [ ] **T-44 États vides complets** (dép. T-40, T-32)
  Compteurs masqués sous 10, badge « New », tous les replis restants ; test E2E sur base vierge.
  Stories : US-70. Tests : U, E.

## Phase 5 — Modération, administration, conformité

- [ ] **T-50 Signalements** (dép. T-41)
  Motifs, signalement de profil, masquage automatique limité aux signalements de comptes éligibles (vérifiés depuis plus de 7 jours, non sanctionnés).
  Stories : US-51. Tests : U, I, E.

- [ ] **T-51 File de modération et recours** (dép. T-50, T-18)
  Décisions motivées (Digital Services Act), formulaire de recours depuis la notification, recours traité par un autre modérateur, annulation d'une décision automatique, notifications.
  Stories : US-52. Tests : U, I, E.

- [ ] **T-52 Sanctions** (dép. T-51)
  Avertissement, suspension, bannissement (admin + réauthentification), effets sur toutes les politiques, `banned_identities` contre la réinscription.
  Stories : US-53. Tests : U, I (matrice avec rôle suspendu), E.

- [ ] **T-53 Back-office** (dép. T-18, T-20, T-08, T-23)
  Écrans `/admin` : versions du jeu, file des zones à valider (fusion), réglages du site et flags (réauthentification), journal d'audit, invitations et liste d'attente, publication d'une nouvelle version des Terms (notification J-15, écran de réacceptation).
  Stories : US-54, US-56, US-57.1, US-58.2, US-74.2–3. Tests : U, I, E.

- [ ] **T-54 Signalement de bug** (dép. T-12, T-18) — **action humaine** : dépôt privé et GitHub App (Q10).
  Module `feedback`, anti-spam complet, échappement, disjoncteur, écran admin « marquer spam ».
  Stories : US-60. Tests : U, I, E.

- [ ] **T-55 Suppression de compte** (dép. T-27, T-28, T-41, T-40, T-52)
  `pending_deletion`, annulation, purge J+30 (Queue `account-purge`) sur toutes les tables, R2 (captures et avatar), PostHog ; pseudonymisation dans l'audit et la modération ; empreinte `banned_identities` si banni ; test de cascade exhaustif (échoue si une table liée à `users` n'est pas couverte).
  Stories : US-09. Tests : U, I (cascade), E.

- [ ] **T-56 Exploitation** (dép. T-04)
  Runbooks `docs/runbooks/` : restauration (et test réel de restauration Neon + R2 `trash/`), incident (rotation des secrets, mode lecture seule), modération (procédure contenus illicites, PHAROS) ; alertes de `03-architecture.md` § Observabilité ; workflow GitHub Actions planifié `pg_dump` chiffré vers R2.
  Tests : exercice de restauration documenté dans la PR.

- [ ] **T-57 Durcissement et revue de sécurité** (dép. T-50 à T-55)
  Matrice d'autorisation complète verte, OWASP ZAP sans alerte « High », checklist ASVS niveau 2, CSP sans violation, budgets de performance, audit d'accessibilité complet, vérification de la rétention.
  Stories : US-68, US-75. Tests : I, E, ZAP, Lighthouse.

- [ ] **T-58 Recette MVP et bêta fermée** (dép. T-57) — **action humaine** : validation de Q6, Q7, Q8, Q11, Q13 ; registre des traitements et accords de sous-traitance signés (Q11).
  Exécution de tous les parcours de `11-strategie-de-tests.md` § 5 sur la preview de release, puis **bêta en production** avec `features.inviteOnly` (20 à 30 photographes, ≥ 200 captures ; jamais sur une preview, protégée par Access), correction des retours. **Action humaine avant l'ouverture** : Resend Pro et Neon Launch actifs (`05-finops.md`), décision sur le plan Cloudflare Pro.

**Jalon : ouverture publique (désactivation du mode invitation).**

## Phase 6 — v1.x (chaque tâche livrée derrière son flag)

- [ ] **T-60 Abonnements et fil** (dép. T-58) — US-33. Tests : U, I, E.
- [ ] **T-61 Collections** (dép. T-58) — US-34. Tests : U, I, E.
- [ ] **T-62 Récap email hebdomadaire** (dép. T-58) — US-36. Tests : U, I.
- [ ] **T-63 Classement** (dép. T-58) — `leaderboard_snapshots`, cron 5 min, « Your best ». US-22, US-70.3. Tests : U, I, E.
- [ ] **T-64a Concours : modèle et cycle de vie** (dép. T-63) — machine à états, cron idempotent, back-office. US-40, US-44, US-46. Tests : U (horloge simulée), I.
- [ ] **T-64b Concours : participation** (dép. T-64a) — US-41. Tests : U, I, E.
- [ ] **T-64c Concours : score et anti-triche** (dép. T-64b) — US-42, US-43. Tests : U, I.
- [ ] **T-64d Concours : résultats et archives** (dép. T-64c) — badges, hero, bandeau de quête. US-45, US-47. Tests : U, I, E.
- [ ] **T-65 Export de données** (dép. T-58) — US-06. Tests : U, I.
- [ ] **T-66 Partage depuis Android** (dép. T-26) — US-66. Tests : E.
- [ ] **T-67 Publicité** (dép. T-58, Q2) — US-73, CSP conditionnelle. Tests : E.
- [ ] **T-68 Soutien : dons ponctuels** (dép. T-58, Q20, Q21) — US-76, table `donations` créée en T-05 avec le flag désactivé. Tests : U, I, E.
- [ ] **T-69 Soutien : badge et historique** (dép. T-68) — US-77, US-78. Tests : U, E.

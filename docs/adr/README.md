# ADR-001 — Nuxt full-stack en monolithe modulaire

- **Statut** : accepté
- **Contexte** : une seule application consomme le back ; développement par IA ; budget réduit.
- **Décision** : Nuxt (Vue 3) full-stack, un seul Worker, modules métier isolés dans `server/modules/`.
- **Alternatives rejetées** : architecture MACH/microservices (surcoût d'infra et de déploiement) ; front découplé + API (aucun second consommateur prévu).
- **Conséquences** : un seul déploiement ; découpage ultérieur possible module par module.

# ADR-002 — Cloudflare Workers + R2 + Queues

- **Statut** : accepté
- **Contexte** : trafic initial faible, croissance possible ; une galerie consomme surtout de la bande passante.
- **Décision** : Workers pour l'exécution, R2 pour les images (pas de frais de sortie), Queues pour l'asynchrone, previews par branche via GitHub.
- **Alternatives** : Vercel (habitude d'Adrien, mais bande passante images plus chère) ; AWS Lambda + S3 (egress payant, plus d'ops).
- **Conséquences** : contraintes du runtime Workers (pas de modules Node natifs, 128 Mo de mémoire par isolate : traitement d'image délégué au binding Images, cf. ADR-011).

# ADR-003 — PostgreSQL serverless Neon via Hyperdrive

- **Statut** : accepté
- **Décision** : Neon (à l'usage, plan Launch dès l'ouverture publique pour la restauration à un instant donné), connexion via Hyperdrive en production, Drizzle ORM, une branche Neon par preview connectée directement au pooler Neon (ADR-013).
- **Alternatives** : Cloudflare D1 (SQLite, full-text et relations plus limités) ; Supabase (plus de services que nécessaire).

# ADR-004 — Originaux conservés, variantes à la volée

- **Statut** : accepté, **partie « à la volée » remplacée par ADR-012** (revue du 17/11/2026 ; le bucket privé et le téléchargement présigné restent en vigueur)
- **Décision** : on stocke uniquement l'original nettoyé (métadonnées retirées sans réencodage, cf. ADR-011) dans un **bucket R2 privé** ; les tailles d'affichage (400, 800, 1200, 2400) sont générées par le binding Images depuis une route du Worker et mises en cache CDN. Les originaux ne sont jamais accessibles publiquement (téléchargement par URL présignée de 5 min, réservé aux membres).
- **Conséquences** : stockage minimal ; coût proportionnel au nombre de transformations uniques, limité par les tailles fixes.

# ADR-005 — Modération externe Sightengine

- **Statut** : accepté
- **Décision** : appel asynchrone depuis la Queue, seuils configurables, repli en revue manuelle si indisponible.
- **Alternatives** : Google Cloud Vision SafeSearch, Amazon Rekognition (plus génériques, facturation équivalente ou supérieure).

# ADR-006 — Analytics PostHog EU + Cloudflare Web Analytics

- **Statut** : accepté
- **Décision** : Web Analytics sans cookie toujours actif ; PostHog hébergé en UE après consentement pour l'analyse produit.
- **Alternatives** : GA4 + GTM (orienté marketing, risque CNIL, pages plus lourdes).

# ADR-007 — Recherche : PostgreSQL full-text + pg_trgm

- **Statut** : accepté
- **Contexte** : recherche par texte, zone, personnage et tags ; site bilingue EN/FR ; budget minimal ; volume attendu < 1 M photos à moyen terme.
- **Décision** : recherche native Postgres dans Neon.
  - Colonne `photos.search_vector` (tsvector générée) sur titre (poids A), zone + personnage (B), description (C), avec la configuration `simple` + `unaccent` (pas de stemming EN ou FR, pour couvrir les noms propres dans les deux langues).
  - Tags via jointure `photo_tags`, correspondance exacte sur `tags.slug`.
  - **Dictionnaire des zones** (table `zones`) : la requête est d'abord résolue contre `name_en`, `name_fr` et `aliases` (exact puis trigram) ; une zone trouvée ajoute un filtre `photo_metadata.zone_id = …`, combiné en OR avec le full-text. « Stormwind », « Hurlevent » et « SW » renvoient donc les mêmes photos. Les noms EN, FR et alias de la zone sont aussi injectés dans `search_vector` (poids B).
  - Index GIN sur `search_vector`.
  - Extension `pg_trgm` + index GIN trigram sur `tags.label`, la zone et le titre : tolérance aux fautes (`similarity` ≥ 0,3) et autocomplétion.
  - Score final = `ts_rank` × 0,6 + log(likes + 1) normalisé × 0,3 + bonus de récence × 0,1 ; tri « récent » / « populaire » proposé à l'utilisateur.
- **Alternatives** : Meilisearch ou Typesense (≈ 30–50 $/mois hébergé, meilleure recherche instantanée et facettes) ; Algolia (coût élevé à l'usage). À reconsidérer via un nouvel ADR si p95 > 300 ms ou si des facettes instantanées deviennent nécessaires.
- **Conséquences** : aucun service supplémentaire ; la synchro d'index est gérée par Postgres ; migration ultérieure possible en alimentant un moteur externe depuis la Queue.

# ADR-008 — PWA : Workbox en injectManifest, cache sélectif

- **Statut** : accepté
- **Contexte** : site très riche en images, pages personnalisées par la session, besoin d'un hors-ligne utile mais limité, partage d'images depuis le téléphone.
- **Décision** : @vite-pwa/nuxt en mode `injectManifest` (SW écrit à la main avec Workbox) pour gérer le share target et le nettoyage à la déconnexion ; stratégies par type de ressource (cf. `03-architecture.md` § PWA) ; mises à jour à la demande de l'utilisateur.
- **Alternatives** : `generateSW` (plus simple, mais pas de handler POST pour le share target) ; aucun SW (pas d'installation ni de hors-ligne).
- **Conséquences** : un fichier `sw.ts` à maintenir et à tester (Playwright avec `serviceWorkers: "allow"`) ; vigilance sur les données privées en cache.

# ADR-009 — Clean Architecture modulaire contrôlée en CI

- **Statut** : accepté
- **Contexte** : développement réalisé par une IA tâche par tâche ; risque d'érosion de la structure et de couplage entre modules.
- **Décision** : couches domain / application / infrastructure / interface par module, ports et adaptateurs, `shared/contracts` et `shared/domain` communs au client et au serveur, front en pages fines + features + design system ; règles vérifiées par dependency-cruiser et ESLint (`10-clean-architecture.md`).
- **Alternatives** : structure par type de fichier Nuxt seule (plus simple mais logique métier dispersée dans les routes) ; hexagonal strict avec bibliothèque d'injection (surdimensionné).
- **Conséquences** : un peu plus de fichiers par fonctionnalité ; règles métier testables sans base ni réseau ; fakes réutilisables en tests et en preview.

# ADR-010 — Sessions vérifiées en base

- **Statut** : accepté
- **Contexte** : un cookie scellé seul ne permet pas de révoquer les sessions (reset de mot de passe, bannissement, « déconnecter partout »).
- **Décision** : le cookie scellé `nuxt-auth-utils` ne contient qu'un identifiant aléatoire ; la table `sessions` est vérifiée à chaque requête authentifiée (requête indexée via Hyperdrive) ; rotation de l'identifiant à la connexion et aux changements de privilège.
- **Alternatives** : JWT courts + liste de révocation (plus complexe) ; cookie scellé sans état (révocation impossible).
- **Conséquences** : une lecture base par requête authentifiée (négligeable via Hyperdrive) ; révocation immédiate.

# ADR-011 — Traitement d'image sans décodage dans le Worker

- **Statut** : accepté (revue du 17/11/2026)
- **Contexte** : les isolates Workers sont limités à 128 Mo de mémoire, WebAssembly compris, partagés entre requêtes simultanées ; une capture 8K (7680 × 4320, limite retenue le 17/11/2026) décodée en RGBA occupe ~133 Mo, plus que la limite à elle seule. Le binding Images accepte des entrées jusqu'à 20 Mo depuis R2 et fournit `info()` (format, dimensions).
- **Décision** : (1) TGA converti en PNG dans le navigateur ; fichier de plus de 20 Mo converti dans le navigateur en WebP sans perte, puis en JPEG 95 4:4:4 si nécessaire (encodeurs WebAssembly, jamais de WebP avec perte pour un original) ; (2) le serveur n'accepte que JPEG, PNG, WebP ; (3) validation par octets magiques + `IMAGES.info()` ; (4) métadonnées supprimées au niveau octet sans réencodage (original sans perte) ; (5) toutes les variantes (affichage, luminance, modération) produites par le binding Images.
- **Alternatives** : décodage WASM (@jsquash, photon) — risque de dépassement mémoire ; Cloudflare Containers — coût et complexité ; service externe (imgproxy) — infrastructure supplémentaire.
- **Conséquences** : Q4 (conversion PNG → WebP) abandonnée, les originaux PNG sont conservés tels quels (stockage un peu plus élevé) ; à valider dès T-22 : si `IMAGES.info()` ou les sorties ne couvrent pas un cas, ouvrir un nouvel ADR.
- **Validation T-00a/b/c (20/11/2026, `prototypes/t00ab-images`, Worker distant)** : aucune erreur mémoire ; 8K JPEG 2,2 Mo → `info()` 336 ms, 6 variantes en 4,1 s ; 8K PNG 17,3 Mo → 536 ms, 5,6 s ; trois PNG 5120×2160 en parallèle → 5,6 s au total. Le décodage se fait dans le service Images, hors de la mémoire du Worker. Limites : images de synthèse (variantes bien plus légères qu'une vraie capture), limite exacte de 20 Mo non testée ; à recontrôler en T-22 sur le corpus `tests/fixtures/images`.

# ADR-012 — Variantes d'affichage générées une fois et stockées dans R2

- **Statut** : accepté (revue du 17/11/2026) ; remplace la partie « variantes à la volée » d'ADR-004.
- **Contexte** : depuis juillet 2026, le binding Images est facturé par transformation unique et par mois civil (0,50 $ / 1 000 au-delà de 5 000) : avec des variantes à la volée, chaque capture consultée dans le mois est refacturée, catalogue ancien compris ; le coût croît avec le stock et non avec les publications. Les sorties AVIF sont limitées à 1 200 px. Les robots de partage social ne lisent pas tous le WebP.
- **Décision** : le consommateur `photo-process` produit une fois pour toutes 4 variantes WebP (400, 800, 1200, 2400) et un JPEG 1200 (modération et `og:image`), plus une vignette PNG 64 px temporaire (luminance) : 6 transformations par capture. Elles sont écrites sous `variants/{id}/` dans le bucket privé et servies par la route `/img` (contrôle du statut, API Cache). Format unique WebP, pas de négociation AVIF.
- **Alternatives** : variantes à la volée (coût mensuel proportionnel au stock consulté, ≈ 3 fois plus cher à 100k MAU) ; AVIF + WebP (limite 1 200 px, double stockage, clé de cache par format) ; bucket public pour les variantes (impossible de masquer immédiatement une capture modérée).
- **Conséquences** : coût de transformation borné et prévisible (≈ 0,003 $ par capture) ; stockage + ≈ 12 % (≈ 1 Mo de variantes pour un original de 8 Mo) ; changer une largeur ou la qualité impose un retraitement par lot (script de migration via la Queue, 6 transformations par capture) ; masquer une capture = déplacer ses variantes dans `trash/` + purge par URL.

# ADR-013 — Une preview complète par pull request

- **Statut** : accepté (revue du 17/11/2026) ; **connexion directe au pooler remplacée par ADR-016** (une configuration Hyperdrive par preview).
- **Contexte** : Adrien veut des previews par branche comme sur Vercel. Les « preview URLs » de versions Workers partagent les bindings de production (base, R2) et seule la version déployée consomme les Queues et exécute les crons. Une Queue n'accepte qu'un Worker consommateur. Hyperdrive est limité à 25 configurations par compte. L'API Cache est inactive sur `workers.dev`.
- **Décision** : la CI crée par PR un Worker `ls-pr-{n}` (configuration générée depuis `wrangler.toml`, environnement `preview`), ses Queues et DLQ suffixées, une branche Neon (connexion directe au pooler), un préfixe dans le bucket R2 `ls-preview`, protégé par Cloudflare Access ; tout est supprimé à la fermeture de la PR (workflow `preview-cleanup`, plus un balayage hebdomadaire des ressources orphelines).
- **Alternatives** : preview URLs de versions (bindings de production, pas de Queue ni de cron) ; un seul environnement de staging partagé (pas de parallélisme entre PR).
- **Conséquences** : environ 10 Queues par PR (10 000 maximum par compte) ; le chemin Hyperdrive et le cache `/img` ne sont testés qu'en production (smoke test après déploiement) ; une preview coûte quelques centimes par jour (crons et branche Neon en veille).
- **Validation T-00g (20/11/2026, `prototypes/t00g-preview`)** : branche Neon, configuration Hyperdrive (ADR-016), Queue, préfixe R2 et Worker créés en 31 à 41 s (critère < 5 min), deux previews en parallèle isolées (chacune ne voit que sa base), suppression complète en 12 s vérifiée par l'API. À reprendre en T-03 : (1) déployer code et secrets dans une seule version (`wrangler deploy --secrets-file`), sinon des requêtes tombent quelques secondes sur une version sans secret ; (2) à la suppression, retirer le Worker des consommateurs de ses Queues avant de le supprimer ; (3) le premier cron d'une preview arrive ≈ 6 min après le déploiement (T-00f). Non testés ici : Cloudflare Access, DLQ, workflow GitHub Actions.


# ADR-014 — CSS natif : variables et styles scopés, sans framework

- **Statut** : accepté (Adrien, 18/11/2026).
- **Contexte** : design maison très spécifique (thème sombre unique, couleurs de qualité, Cinzel), peu d'écrans, règle 10 de `CLAUDE.md` (pas de dépendance pour quelques lignes). Les maquettes `docs/design/*.dc.html` utilisent des styles en ligne imposés par l'outil de maquette : ce ne sont pas du code source.
- **Décision** : CSS natif. `app/assets/css/tokens.css` (seul fichier contenant des valeurs : couleurs, typographies, tailles, espacements, rayons, ombres, z-index, points de rupture documentés), `app/assets/css/base.css` (reset léger, typographie, focus visibles, `prefers-reduced-motion`), styles des composants dans `<style scoped>` n'utilisant que des `var(--…)`. Mobile d'abord (`min-width` uniquement). Pas de préprocesseur (imbrication CSS native). Stylelint (`stylelint-config-standard`, `stylelint-declaration-strict-value`) refuse toute couleur, taille de police, espacement ou z-index en dur hors de `tokens.css` ; lancé dans `pnpm lint`.
- **Alternatives** : Tailwind CSS (plus rapide et homogène avec un agent IA, mais classes dans les templates et dépendance) ; UnoCSS (moins connu des modèles).
- **Conséquences** : aucune classe utilitaire ; un style inline (`style="…"`) est interdit dans les composants, sauf valeur dynamique calculée (ex. `--tier-color`) ; la dérive est contrôlée par Stylelint et par la revue ; le passage à Tailwind resterait possible en réutilisant `tokens.css`.

# ADR-015 — Hachage des mots de passe : Argon2id en JavaScript pur

- **Statut** : accepté (T-00d, 20/11/2026) ; tranche Q5.
- **Contexte** : la spec demande Argon2id, avec scrypt en repli. Mesures sur un Worker distant (`prototypes/t00d-hash`), paramètres OWASP, temps réseau déduit : Argon2id `hash-wasm` refusé (Workers interdit la compilation WebAssembly à l'exécution) ; Argon2id `@noble/hashes` ≈ 170 à 350 ms ; scrypt `node:crypto` ≈ 200 ms ; scrypt `@noble/hashes` ≈ 430 à 520 ms.
- **Décision** : Argon2id via `@noble/hashes` (`argon2id`, m = 19 MiB, t = 2, p = 1, sel de 16 octets, clé de 32 octets), sous le seuil de 500 ms de T-00d.
- **Alternatives** : scrypt natif (plus rapide, mais algorithme second choix de la spec et de l'OWASP) ; Argon2id WASM importé comme module `.wasm` statique (plus rapide, dépendance et chargement à valider).
- **Conséquences** : chaque connexion ou inscription coûte quelques centaines de ms de CPU ; les limites de débit sur `/api/auth/*` (08 § 8) protègent aussi le budget CPU. Paramètres stockés avec le hachage (format PHC) pour pouvoir les durcir plus tard avec un rehachage à la connexion.

# ADR-016 — Hyperdrive sans cache, et une configuration Hyperdrive par preview

- **Statut** : accepté (T-00e, 20/11/2026) ; remplace la connexion directe des previews d'ADR-013. À valider par Adrien (option la plus simple et réversible, règle 6).
- **Contexte** : mesures T-00e (`prototypes/t00e-neon`, Worker en plan Paid, colo CDG → Neon Frankfurt, Postgres 18) :
  - Hyperdrive sans cache : `select 1` en 16–17 ms (médiane), ≈ 80 ms pour la première requête ;
  - Hyperdrive avec cache (réglage par défaut) : 3 ms, mais **une session révoquée reste lue comme valide pendant 76 s** (lecture sans cache : révocation vue immédiatement), contraire à ADR-010 ;
  - connexion directe au pooler Neon avec `postgres` (postgres.js) : 2 s de CPU puis arrêt en plan gratuit ; 6,2 s de CPU, 42 s et connexion fermée en plan Paid. Inutilisable.
- **Décision** :
  1. une seule configuration Hyperdrive en production, **cache désactivé** : toute lecture voit la dernière écriture (sessions, sanctions, statut des captures, likes) ;
  2. chaque preview a **sa propre configuration Hyperdrive** (cache désactivé), créée et supprimée par la CI avec la branche Neon ; même chemin qu'en production.
- **Alternatives** : deux bindings (avec cache pour les grilles publiques, sans cache pour le reste) — plus rapide mais chaque requête doit choisir le bon, risque d'erreur silencieuse ; pilote Neon serverless (HTTP) en preview — chemin différent de la production.
- **Conséquences** : chaque lecture va jusqu'à Neon (≈ 17 ms) ; la charge des grilles est absorbée par le cache CDN des API publiques (`Cache-Control: public, max-age=60`) ; si le calcul Neon devient un poste important, ajouter un binding avec cache réservé aux lectures publiques, par ADR. Maximum 25 configurations Hyperdrive par compte : 1 production + 1 par PR ouverte. Le plan Workers Paid est requis (le plan gratuit coupe les requêtes longues).

# ADR-017 — Hébergement : Cloudflare conservé (clôture de T-00h)

- **Statut** : accepté (Adrien, 20/11/2026) ; clôt T-00h et confirme ADR-002.
- **Contexte** : T-00h devait comparer l'option A (tout Cloudflare) et l'option B (Vercel pour l'application, images ailleurs). L'option B visait surtout les risques de l'option A ; T-00a à T-00g les ont tous levés sur des Workers distants :
  - 8K de 17 Mo traitée sans erreur mémoire, 6 variantes en 4 à 6 s, traitement parallèle sans ralentissement (T-00a/b/c, ADR-011) ;
  - Argon2id en JavaScript sous 500 ms (T-00d, ADR-015) ;
  - Neon via Hyperdrive sans cache : 16–17 ms depuis Paris (T-00e, ADR-016) ;
  - Queues et crons branchés par les hooks Nitro, nouveaux essais fonctionnels (T-00f) ;
  - preview complète par PR créée en 31–41 s, isolée, supprimée sans reste en 12 s (T-00g).
- **Décision** : option A, la stack de `CLAUDE.md` reste inchangée. Pas de chiffrage détaillé de l'option B : aucun risque restant ne le justifiait (option la plus simple, règle 10).
- **Lecture des critères pondérés (18/11/2026)** : coût 25 % — R2 sans frais de sortie, adapté à une galerie, Workers Paid 5 $ ; simplicité 20 % — un seul fournisseur pour calcul, stockage, files, crons et previews ; performance 15 % — mesures ci-dessus ; sécurité et exploitation 15 % — bucket privé, Access sur les previews, WAF ; portabilité 15 % — Nuxt et Drizzle portables (changement de preset Nitro), dépendances fortes limitées au binding Images et aux Queues ; previews 10 % — validées par T-00g.
- **Alternatives** : option B (Vercel + stockage externe) : previews natives et plus de mémoire, mais bande passante des images plus chère, deux fournisseurs et Queues à remplacer ; AWS écarté le 18/11/2026 (droits jugés trop complexes).
- **Conséquences** : T-02 et T-03 sont débloquées. Rouvrir la question par un nouvel ADR si le prix du binding Images ou des Queues change fortement, ou si l'entretien des previews (T-03) s'avère trop lourd.

# ADR-018 — Branche modèle sans données pour les previews

- **Statut** : accepté (T-05b, 21/11/2026)
- **Contexte** : une preview ne doit contenir aucune donnée de production (seed de démo, `03-architecture.md` § Environnements). Les branches Neon `schema-only` le garantissaient, mais Neon les refuse dès qu'un rôle a été créé en SQL ; or le rôle applicatif `ls_app` et le groupe `app_rw` doivent être créés en SQL (un rôle créé par l'API Neon est membre de `neon_superuser` et hérite des droits du propriétaire, T-05a).
- **Décision** : une branche `preview-template`, enfant de `production`, **vidée de toutes ses données** à sa création (`emptyData` : toutes les tables sauf `site_settings`, dont l'auteur est effacé ; testé). `deploy-production` la crée si elle manque et lui applique les mêmes migrations qu'à la production. Les previews (et les branches de développement) sont des branches classiques de ce modèle : elles héritent du schéma, du journal des migrations et des rôles, puis appliquent les migrations de leur PR.
- **Alternatives** : branches classiques de `production` (copient les données personnelles dans chaque preview) ; rôles créés par l'API (moindre privilège perdu) ; journal d'audit protégé par trigger seulement (contournable par le propriétaire).
- **Conséquences** : le schéma du modèle suit la production par les migrations, pas par copie : un changement manuel de la production (interdit, `08-securite.md` § 9) n'y serait pas reflété. Si le modèle disparaît, `node scripts/database.mjs template` le recrée vide ; une preview refuse de démarrer sans lui.

# ADR-019 — Storybook pour documenter le design system

- **Statut** : accepté (21/11/2026, Adrien) ; compatibilité avec Nuxt 4.6 et Vite 8 à vérifier à l'installation (T-06a)
- **Contexte** : `10-clean-architecture.md` § 6 exige des composants UI « documentés et testés isolément » sans dire comment ; il faut une URL qui montre tous les éléments du design system (tokens et composants dans tous leurs états), consultable pendant le développement et sur les previews.
- **Décision** : Storybook via le module **`@nuxtjs/storybook`** (10.x, Storybook 10) et l'addon **`@storybook/addon-a11y`** (axe dans le panneau de chaque story), en dépendances de développement. Une story par composant de `app/components/ui`, couvrant ses états (variantes, désactivé, erreur, focus, mobile 360 px), plus une page « Fondations » qui affiche les tokens de `tokens.css` (couleurs, typographies, espacements, rayons). `pnpm storybook` en local ; la CI construit Storybook à chaque PR (une story cassée fait échouer la PR) ; le build est publié sur chaque preview sous **`/storybook/`** (derrière Cloudflare Access) et jamais en production (même contrôle de l'artefact que les routes `/__test`).
- **Organisation** (atomic design de Brad Frost, sans dossiers dédiés) : atomes et molécules = `app/components/ui` (stories « UI/… ») ; organismes = composants de `app/features/<f>/` ; templates = `app/layouts` ; pages = `app/pages`. Le classement apparaît dans l'arborescence de Storybook, pas dans les dossiers.
- **Alternatives** : page vitrine maison `/styleguide` (aucune dépendance, mais ni isolement des états, ni panneau d'accessibilité, ni contrôles) ; Histoire (moins répandu, intégration Nuxt moins suivie).
- **Conséquences** : dépendances de développement supplémentaires, jamais embarquées dans le Worker. L'addon a11y sert à l'inspection pendant le développement ; le contrôle bloquant reste celui des tests de composants Vitest avec axe (`11-strategie-de-tests.md`). Chaque tâche qui crée un composant UI livre sa story (critère de la DoD).

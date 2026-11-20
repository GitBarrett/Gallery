# 10 — Clean Architecture (back et front)

Objectif : un code que l'IA peut faire évoluer tâche par tâche sans casser l'existant. Les règles métier sont pures et testées sans base ni réseau ; les détails techniques (Nuxt, Drizzle, Cloudflare, fournisseurs) sont des adaptateurs remplaçables.

## 1. Arborescence

```
shared/                       code partagé client + serveur, sans dépendance à Nuxt
  contracts/                  schémas Zod des requêtes/réponses API + types inférés
  domain/                     règles pures réutilisées des deux côtés (ex. quality.ts, validation de fichier côté client)
server/
  modules/
    <module>/
      domain/                 entités, objets valeur, politiques, erreurs métier — TypeScript pur
      application/            use cases (une classe/fonction par cas d'usage), ports (interfaces)
      infrastructure/         adaptateurs : repositories Drizzle, R2, Queues, Sightengine, Resend, GitHub…
      interface/              mappers HTTP ↔ use case, consommateurs de Queue, handlers de cron
      index.ts                API publique du module : use cases exposés + types
  api/                        routes Nitro (fichiers fins, cf. § 3)
  platform/                   composition root, config, logger, erreurs HTTP, auth context, rate limit, tx
  db/                         schéma Drizzle, migrations, seed
app/
  pages/                      pages fines : composent des features, aucune règle métier
  features/<feature>/         composants + composables d'une fonctionnalité (gallery, upload, auth, social…)
  components/ui/              design system : composants de présentation purs (ActionIcon, QualityBadge, ItemTooltip, QuestMarker, BottomSheet, WowImage…)
  composables/                composables transverses (useApi, useSession, useConsent, useOnline)
  services/api/               client API typé (unique endroit qui appelle $fetch)
  layouts/, middleware/, plugins/
```

## 2. Règle de dépendance (serveur)
```
interface ──► application ──► domain
     │              │
     └──► infrastructure ──► (implémente les ports de application)
```
- `domain` n'importe **rien** d'autre que `shared/domain` et la bibliothèque standard : ni Drizzle, ni h3, ni Nuxt, ni `fetch`, ni `Date.now()` direct (horloge injectée).
- `application` dépend de `domain` et déclare des **ports** (`PhotoRepository`, `ObjectStorage`, `ModerationProvider`, `Mailer`, `EventBus`, `Clock`, `IdGenerator`, `RateLimiter`, `UnitOfWork`). Elle orchestre, vérifie l'autorisation et les règles, ne connaît aucune technologie.
- `infrastructure` implémente les ports ; c'est le seul endroit où apparaissent Drizzle, R2, Queues, appels HTTP sortants.
- `interface` traduit HTTP / message / cron → commande de use case → réponse ; aucune règle métier.
- **Entre modules** : uniquement via `index.ts` du module cible (use cases publics ou événements). Pas de jointure SQL entre tables de modules différents dans un repository : utiliser un port de lecture dédié exposé par le module propriétaire, ou une vue de lecture documentée (ex. grilles de `gallery`).

## 3. Anatomie d'une route
```ts
// server/api/photos/[id]/like.put.ts
export default defineEventHandler(async (event) => {
  const ctx = await requireContext(event)                       // session, rôle, statut, correlationId
  const { id } = await getValidatedRouterParams(event, PhotoIdParams.parse)
  const result = await ctx.container.social.likePhoto({ photoId: id, actor: ctx.actor })
  return toLikeResponse(result)                                 // mapper vers shared/contracts
})
```
Interdits dans `server/api/*` : accès base, appel de fournisseur, règle métier, `if (user.role === …)`. Une route fait au plus ~20 lignes.

## 4. Anatomie d'un use case
```ts
// server/modules/social/application/like-photo.ts
export const likePhoto = (deps: { photos: PhotoReadPort; likes: LikeRepository; events: EventBus; limiter: RateLimiter; clock: Clock }) =>
  async (cmd: { photoId: PhotoId; actor: Actor }): Promise<Result<LikeState, LikeError>> => {
    requireMember(cmd.actor); notSanctioned(cmd.actor)                 // politiques du domaine
    await deps.limiter.consume('like', cmd.actor.id)                   // port
    const photo = await deps.photos.getPublished(cmd.photoId)
    if (!photo) return err('PHOTO_NOT_FOUND')
    if (photo.authorId === cmd.actor.id) return err('SELF_LIKE_FORBIDDEN')
    const state = await deps.likes.add(cmd.actor.id, photo.id, deps.clock.now())  // idempotent
    if (state.crossedQualityThreshold) await deps.events.publish(qualityReached(photo, state))
    return ok(state)
  }
```
- Retour par `Result<T, E>` pour les erreurs métier attendues ; exceptions réservées aux erreurs techniques. Le mapping erreur métier → code HTTP est centralisé dans `platform/http-errors.ts`.
- Transactions via le port `UnitOfWork` ; les événements sont publiés **après** commit (outbox simple : table `outbox` relayée vers la Queue si la publication échoue).

## 5. Composition et injection
- `server/platform/container.ts` construit, par requête, les use cases avec leurs adaptateurs à partir des bindings Cloudflare et de la config validée.
- En test, le même container est construit avec des **fakes en mémoire** (`tests/fakes/`) : `InMemoryPhotoRepository`, `FakeObjectStorage`, `FakeModerationProvider`, `FixedClock`, `RecordingEventBus`…
- `NUXT_FAKE_PROVIDERS=true` (local, preview) branche les fakes de fournisseurs externes sur le vrai container.

## 6. Front (Nuxt / Vue)
- **Pages** : récupèrent les paramètres de route, appellent un composable de feature, composent des composants. Pas d'appel `$fetch` direct, pas de règle métier.
- **Features** (`app/features/*`) : composables d'application (`useUploadCapture`, `useGalleryFeed`, `useLike`) qui orchestrent le client API, l'état et les règles partagées (`shared/domain`), et composants spécifiques à la feature.
- **Composants UI** (`app/components/ui`) : présentation pure, entrées par props, sorties par événements, aucun appel réseau ni accès au store ; documentés et testés isolément.
- **Styles** (ADR-014) : valeurs uniquement dans `app/assets/css/tokens.css` ; composants en `<style scoped>` avec `var(--…)` ; pas de style inline statique ; les pages ne stylent que la mise en page (grille, espacements entre blocs).
- **Client API** (`app/services/api`) : fonctions typées générées à partir de `shared/contracts` ; gère le format d'erreur commun, l'identifiant de corrélation, les retries idempotents ; seul point de contact avec `/api`.
- **État** : `useState`/`useAsyncData` de Nuxt ; Pinia uniquement si un état global non dérivable apparaît (ADR requis).
- **Règles partagées** : calcul de qualité, validation de fichier, limites de longueur sont dans `shared/domain` et utilisées des deux côtés (une seule source de vérité, le serveur revalide toujours).
- **i18n** : aucun texte en dur ; clés par feature (`gallery.empty.title`).

## 7. Contrôles automatiques (CI)
- **dependency-cruiser** (`.dependency-cruiser.cjs`) : échec si
  - `server/modules/*/domain` importe autre chose que `shared/domain` ;
  - `application` importe `infrastructure`, `interface`, Drizzle, h3 ou Nuxt ;
  - un module importe un fichier interne d'un autre module (hors `index.ts`) ;
  - `server/api/*` importe `infrastructure` ou `db` ;
  - `app/components/ui` importe `services`, `features` ou `$fetch` ;
  - `app/pages` importe `services/api`.
- **ESLint** : `vue/no-v-html` (erreur), `no-restricted-imports` pour les règles ci-dessus côté Vue, `@typescript-eslint/no-explicit-any` (erreur), complexité cyclomatique ≤ 10 dans `domain` et `application`.
- **Test d'architecture** : chaque fichier de `server/api` est enregistré dans la matrice d'autorisation (`08-securite.md` annexe B) et déclare une politique.

## 8. Exemple de découpage : module `media`
| Couche | Contenu |
|---|---|
| domain | `UploadRequest` (format, taille, dimensions), `ImageFormat`, `FileValidationPolicy`, `LuminanceZone`, erreurs `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `DIMENSIONS_OUT_OF_RANGE`, `UNSUPPORTED_ORIENTATION`, `SIZE_MISMATCH` |
| application | `requestUploadUrl`, `completeUpload`, `processCapture`, `requestDownload`, `deleteCapture`, `serveImage` ; ports `ObjectStorage`, `ImageService` (`info`, `renderVariant` — appelé uniquement par `processCapture`, jamais par `serveImage`, ADR-012), `MetadataStripper`, `ModerationGateway`, `CaptureRepository`, `UploadQuota`, `CachePurger` |
| infrastructure | `R2ObjectStorage` (présignature, lectures partielles), `CloudflareImagesService` (binding Images, ADR-011), `ByteLevelMetadataStripper`, `DrizzleCaptureRepository`, `QueueEventBus`, `CloudflareCachePurger` |
| interface | routes `/api/photos/*`, consommateur `photo-process`, route `/img/{id}/{w}`, cron de nettoyage des orphelins |

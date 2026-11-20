# 07 — Design

## Objectif
Un univers qui évoque fortement WoW, porté par les captures de la communauté. Aucun logo, icône, police ou asset extrait du jeu ou des sites Blizzard.

## Directions proposées
Statut : **direction A — Nuit d'Azeroth retenue** (16/11/2026), avec le kit d'identité WoW appliqué. Maquette de référence : `docs/design/Main.dc.html`. Home finale = **hero plein écran de B** (photo communautaire, header transparent, titre + 2 CTA en bas à gauche, crédit de l'auteur) **+ contenu de A** en dessous. C abandonnée, B archivée.

| | A — Nuit d'Azeroth | B — Cinématique | C — Grimoire |
|---|---|---|---|
| Inspiration | Maxroll | Site officiel Blizzard | WoW Classic, tapaunepo.fr |
| Ambiance | Sombre, moderne, dense | Épique, plein écran, immersif | Chaleureux, parchemin, artisanal |
| Fond | Bleu nuit #0B0E14 | Noir profond #050608 + photo héro | Parchemin #E9DCC0 / cuir #2A1E14 |
| Accent | Or #E8B54A, bleu arcane #4FA3FF | Or chaud #F2C26B | Rouge sceau #9B2C1F, or #B8862F |
| Titres | Cinzel | Cinzel Decorative | Uncial Antiqua / Cinzel |
| Texte | Inter | Inter | Crimson Pro |
| Cadres | Fines bordures dorées, coins nets | Aucun cadre, dégradés sur photos | Bordures ornées, coins décoratifs SVG |

Polices : toutes Google Fonts, licence libre.

## Règles communes
- **Thème sombre uniquement** (pas de mode clair) : les captures de jeu ressortent mieux sur fond sombre ; ne pas ajouter de bascule de thème.
- Écrans sans maquette : composer uniquement avec le design system existant, captures desktop et mobile jointes à la PR.
- Accessibilité : règles de US-75 (focus visible, piégeage du focus, mouvement réduit, texte alternatif, qualité jamais signalée par la couleur seule).
- Les photos priment : UI en retrait sur la grille et la vue détaillée.
- Contrastes AA, mode sombre natif (A, B) ; C propose une variante sombre « cuir ».
- Mention obligatoire en pied de page : « World of Warcraft et Blizzard Entertainment sont des marques de Blizzard Entertainment, Inc. Ce site n'est ni affilié ni approuvé par Blizzard Entertainment. »
- Ornements dessinés maison (SVG), jamais repris du jeu.

## Codes visuels WoW (communs aux trois directions)
Maquette : `docs/design/Identite.dc.html`.
- **Icônes façon barre d'action** : carré 68 px, cadre métal gris biseauté, ombre intérieure noire, reflet haut, fond coloré par icône, pictos **pleins et peints** (dégradés or, acier, cuir, parchemin…) dessinés maison, contour fin (0,7) et halo lumineux doux (même famille que les marqueurs de quête) (boussole, plume, portail, coffre, grimoire, coupe, épées, heaume, bouclier, enclume, engrenage, orbe, astrolabe pour « Game version »…).
- **Qualité des captures selon les likes** : Poor #9D9D9D, Uncommon #1EFF00, Rare #3D9BFF (éclairci pour AA), Epic #C77DFF, Legendary #FF8000. Seuils **configurables** (`site_settings.quality_thresholds`) : cibles 10 / 100 / 500 / 1 000, valeurs de lancement 3 / 15 / 50 / 150. Cadre et titre de la photo prennent la couleur.
- **Marqueurs de quête** : « ! » = nouveauté ou concours, « ? » = action à faire ; formes arrondies sans contour, dégradé #FFF27A → #FFD100 → #FF7A00 avec halo lumineux (flou gaussien) ; état « lu » ou terminé en blanc → gris clair, même halo. Dessinés maison d'après le rendu du jeu ; ne jamais intégrer les sprites du jeu.
- **Infobulle façon objet** : fond bleu nuit, bordure argent, titre à la couleur de qualité, ligne verte « Use: », légende de l'auteur en jaune italique.

## Pages maquettées (direction A)
Maquettes dans `docs/design/`, cliquables entre elles (liens d'une planche à l'autre). Header et footer sont des composants partagés. Copies synchronisées avec le canevas le 17/11/2026 (la planche Grimoire, abandonnée, est retirée ; l'inscription montre la case obligatoire « 15 ans + Terms » de US-01.1). Les maquettes montrent la navigation cible : au MVP, appliquer la composition réduite du § Header. Les polices chargées depuis Google Fonts dans les maquettes sont auto-hébergées dans l'application (`@nuxt/fonts`).

| Page | Fichier | Route cible | User stories |
|---|---|---|---|
| Accueil | Main.dc.html | `/` | US-20, US-24, US-70 |
| Catégorie (PLP) | Category.dc.html | `/v/{version}` | US-20, US-21 |
| Photo (PDP) | Photo.dc.html | `/p/{id}-{slug}` | US-20, US-23, US-25, US-30 à US-34, US-51, US-70 |
| Upload | Upload.dc.html | `/upload` | US-10 à US-13 |
| Profil | Profile.dc.html | `/u/{username}` | US-05, US-33, US-34 |
| Réglages du compte | à maquetter | `/settings` | US-07, US-09 |
| Connexion / inscription / mot de passe oublié | SignIn.dc.html | `/signin`, `/signup`, `/reset` | US-01 à US-04 |
| Classement | Leaderboard.dc.html | `/leaderboard` | US-22 |
| Concours | Contest.dc.html | `/contests/{slug}` | US-40 à US-47 |
| Notifications (« Quest log ») | Notifications.dc.html | `/notifications` | US-35 |
| Signaler un bug (modale) | BugReport.dc.html | modale globale + `/report` | US-60 |
| Header / Footer | Header.dc.html, Footer.dc.html | composants | US-35, US-60, US-62 |

À maquetter ensuite : réglages du compte, back-office (modération, sanctions, réglages, audit), bandeau cookies, 404 et 500.

## Texte sur image : règles de contraste (obligatoires)
Les photos sont imprévisibles (neige, ciel clair, flash de sort) : aucun texte ne doit dépendre de l'image pour être lisible.
1. **Jamais de texte posé directement sur une photo.** Toujours un voile (scrim) entre les deux : dégradé de #0B0E14 à 85–90 % côté texte vers 15 % côté image, ou un fond plein sous le bloc de texte. Un `text-shadow` seul ne suffit pas.
2. **Badges et pastilles sur image** (qualité, « Capture of the week », boutons ronds) : fond sombre ≥ 85 % d'opacité + bordure.
3. **Zone de texte fixe** : en bas à gauche des visuels larges (hero, bannières), jamais centrée sur l'image.
4. **Luminance calculée à l'upload** : le consumer de traitement mesure la luminance moyenne des zones bas-gauche et haut-droite et la stocke (`photos.luma_bl`, `photos.luma_tr`, 0–1). Au-dessus de 0,6, le scrim passe à son niveau maximal ; au-dessus de 0,8, la photo n'est pas proposée en hero ou bannière.
5. **Point focal** facultatif saisi par l'auteur ou l'admin (`photos.focal_x`, `photos.focal_y`) pour l'`object-position` des recadrages.
6. **Test automatique** : fixtures Playwright avec une image blanche pure et une image noire pure sur la home, la PLP et la PDP ; contrôle axe-core `color-contrast` sans erreur (AA, 4,5:1 ; 3:1 au-delà de 24 px).

## Hero de la home
- Image : une capture de la communauté choisie par l'admin (ou la Legendary de la semaine), `luma_bl` ≤ 0,6 obligatoire.
- Header transparent posé sur l'image, voile haut 80 % → 0.
- Texte en bas à gauche sur voile horizontal 88 % → 0, voile bas qui fond vers #0B0E14 pour enchaîner avec la page.
- Crédit de la photo toujours affiché, sur fond sombre, avec lien vers la PDP.

## Nom et logotype
- Nom : **Legendary Shots** (anglais, aucune marque Blizzard).
- Logotype provisoire : Cinzel 700, capitales espacées 0,08em ; « Legendary » en orange qualité légendaire #FF8000, « Shots » en or #E8B54A. Logo final : `docs/design/Logo.dc.html` (emblème « diaphragme légendaire » dans un cadre octogonal doré, wordmark empilé, version horizontale `LogoMark.dc.html`, icône d'app, monochromes clair et sombre).
- Slogan : « Azeroth, seen by its players. » — tolérable car descriptif ; à valider avec Q7 (usage de « Azeroth » en accroche, jamais dans le nom ou le domaine).

## Header
Une seule ligne à partir de 1180 px : logo · Explore · Leaderboard · Contests · Collections · recherche (s'étire) · **Upload** · [connecté : notifications + avatar] ou [visiteur : **Sign in** tout à droite]. **Au MVP**, Leaderboard, Contests et Collections sont masqués par leurs flags (v1.x) : la ligne devient logo · Explore · recherche · **Upload** · notifications + avatar / Sign in ; chaque entrée réapparaît avec son flag, sans changer la maquette. Entre 760 et 1180 px, la navigation passe en icônes seules ; sous 760 px, la recherche passe en icône. Sur la home, le header est transparent au-dessus du hero.

## États vides et démarrage à froid (obligatoire)
Au lancement, le site sera presque vide. Règle générale : **aucun bloc ne s'affiche vide ni avec un « 0 »**. Chaque module a un seuil ; en dessous, il prend un contenu de repli ou disparaît.

| Module | Seuil | Repli |
|---|---|---|
| PDP « More from {auteur} » | ≥ 2 autres photos de l'auteur | 1 photo : elle + complément « Similar captures » (même zone, puis même version) jusqu'à 4 ; 0 : bloc renommé « More from {zone} » puis « Latest in {version} » ; rien : bloc masqué |
| Home « Capture of the week » | ≥ 1 photo publiée sur 7 j avec ≥ 10 likes | Plus likée sur 30 j, puis de tous les temps, puis « Editor's pick » choisi par l'admin |
| Hero de la home | — | Toujours une image choisie par l'admin (jamais vide) |
| Classement | ≥ 10 photos sur la période | Bascule automatique sur le mois puis « All time » ; sinon jauge « The leaderboard opens at 10 captures this week (4/10) » + CTA Upload |
| Onglet de version / PLP | ≥ 1 photo | Onglet affiché mais page vide illustrée : « Be the first to capture {version} » + CTA Upload |
| Concours | ≥ 10 participations à la clôture | Prolongation automatique de 7 jours, une fois ; ensuite clôture sans podium si < 3 |
| Profil sans capture | — | Message + CTA Upload (pour soi), « No captures yet » (pour les autres) |
| Commentaires | 0 | « Be the first to comment » |
| Fil Abonnements | 0 abonnement | Suggestions de 6 photographes actifs |
| Recherche sans résultat | 0 | Suggestion orthographique (pg_trgm), tags populaires, dernières captures |
| Compteurs (likes, téléchargements, commentaires) | < 10 | Non affichés ; badge « New » à la place |

**Seuils de qualité au lancement** : configurables (`site_settings`) ; valeurs de lancement abaissées à 3 / 15 / 50 / 150 likes pour Uncommon / Rare / Epic / Legendary, à remonter vers 10 / 100 / 500 / 1 000 avec l'audience.
**Amorçage** : bêta fermée de 20 à 30 photographes et au moins 200 captures avant l'ouverture publique.

## Expliquer la qualité des captures (points de contact)
Personne ne doit avoir à deviner ce que veut dire « Epic ». Les seuils affichés sont toujours lus dans `site_settings`, jamais écrits en dur.
1. **Filtre « Minimum quality » (PLP, recherche)** : bouton « ? » qui ouvre une infobulle avec les 5 niveaux, leurs seuils et un lien « How quality works ».
2. **Badge de qualité sur une photo** (grille, PDP) : au survol ou au tap, « Rare · 100+ likes · 38 likes to Epic ».
3. **Upload** : l'aperçu en direct rappelle que toute capture démarre Poor et progresse avec les likes (déjà maquetté).
4. **Première visite** : après la première capture publiée, une notification « Quest log » explique le système une seule fois (« Your capture is Poor for now: 10 likes to Uncommon »).
5. **Passage de niveau** : notification à chaque palier atteint (« Dawn on the Plains reached Epic »).
6. **Profil (pour soi)** : barre de progression vers le palier suivant sur ses captures.
7. **Page `/help/quality`** : explication complète, seuils actuels, pourquoi ils évoluent, comment sont comptés les likes (comptes vérifiés, pas d'auto-like).

## Boutons de connexion tierce
- Logos Google et Battle.net : **fichiers officiels uniquement**, jamais redessinés. Google : respecter les consignes de marque « Sign in with Google » (logo « G » officiel, fond blanc ou sombre, texte « Continue with Google »). Battle.net : logo du kit de marque Blizzard, sous réserve de leurs conditions (cf. Q7).
- Les maquettes affichent un emplacement « LOGO » à remplacer à l'intégration.

## Responsive et mobile (mobile d'abord)
Implémentation CSS : natif, voir ADR-014 (tokens dans `app/assets/css/tokens.css`, les maquettes ne sont qu'une référence visuelle).

Points de rupture : xs < 480 · sm 480–767 · md 768–1023 · lg 1024–1279 · xl ≥ 1280. CSS écrit mobile d'abord. Hauteurs plein écran en `svh`/`dvh`, marges `env(safe-area-inset-*)` (encoche, barre d'accueil iOS).

| Élément | < 768 px | ≥ 768 px |
|---|---|---|
| Header | Emblème seul, recherche en icône, avatar ou Sign in ; se masque au défilement vers le bas, réapparaît vers le haut | Header complet sur une ligne |
| Navigation | **Barre d'onglets en bas** : cible Explore · Leaderboard · **Upload** (central, mis en avant) · Contests · Profile ; **au MVP** (flags désactivés) Explore · Search · **Upload** · Notifications · Profile | Dans le header |
| Grille masonry | 2 colonnes, gouttière 8 px | 3 (md), 4 (lg), 5 (xl) |
| Hero home | 70 svh, texte en bas, point focal de la photo respecté | 680 px |
| PDP | Image pleine largeur, swipe gauche/droite = précédente/suivante, pinch-zoom en plein écran ; barre d'actions collante en bas (Like, Download, Share natif ; Collect avec `features.collections`) ; infobulle d'objet sous l'image | Deux colonnes |
| Infobulles (qualité, objet) | Ouverture au tap en **bottom sheet** | Survol et focus clavier |
| Filtres PLP | Bouton « Filters » → bottom sheet plein écran | Barre de filtres |
| Upload | Sélecteur de la galerie photo (`accept="image/*"`), sections repliables, barre de progression avec reprise en cas de coupure | Deux colonnes avec aperçu |
| Classement, notifications | Liste simple, podium en carrousel horizontal | Comme maquetté |

Règles : cibles tactiles ≥ 44 px ; aucune fonction accessible seulement au survol ; partage via `navigator.share` quand disponible.

### Invitation à l'installation
Jamais au premier chargement. Proposée après la 2e visite ou après la première capture publiée, dans le menu du profil et via un bandeau discret ; si refusée, plus proposée pendant 30 jours. Sur iOS (pas d'événement `beforeinstallprompt`) : feuille d'instructions « Share → Add to Home Screen ».

## Emplacements publicitaires et soutien (v1.x, masqués par flags)

Maquettes : `docs/design/Support.dc.html` (page `/support`, remerciement, badge), placeholders publicitaires dans `Footer.dc.html`, `Photo.dc.html` et `Main.dc.html`.

Ces écrans sont prévus dès le MVP pour que la v1.x s'intègre sans refonte. Ils restent masqués tant que `features.ads` (US-73) ou `features.donations` (US-76 à US-78) est désactivé.

### Emplacements publicitaires (`features.ads`)
1. **Pied de page** : bannière horizontale au-dessus des liens légaux, sur toutes les pages.
2. **Grille de la home et des PLP** : une annonce carrée après chaque 24 captures, de la largeur d'une miniature.
3. **Page photo** : aucune annonce au-dessus de l'image ; un emplacement latéral sous les infobulles, sur grand écran seulement.
4. **Interdit** : hero de la home, bandeaux de quête, écrans de connexion, d'upload et de réglages.

Chaque emplacement a une hauteur réservée (CLS). Le libellé « Advertisement » est affiché au-dessus de chaque annonce. Si la régie ne répond pas, la zone se replie sans bruit. Placeholders du canevas : Footer.dc.html (bannière 728×90), Photo.dc.html (colonne 300×250, desktop ≥ 1280 px), Main.dc.html (une annonce après la grille). Sans contenu de régie, libellés « Advertisement ».

### Soutien du site (`features.donations`)
1. **Bouton « Support the site »** : footer, et menu du profil.
2. **Page `/support`** : raisons du soutien (coûts réels, transparence), montants 2 €, 5 €, 10 €, champ libre à partir de 2 €, sans compte.
3. **Paiement** : délégué au prestataire (page hébergée ou fenêtre intégrée), jamais de donnée bancaire sur le site.
4. **Page de retour** : remerciement, ou état « en attente » si le paiement est asynchrone.
5. **Page d'annulation** : message neutre, retour à `/support`.
6. **Badge « Supporter »** sur le profil, seulement si le donateur l'accepte. Aucune contrepartie dans le classement, les concours ou la modération.
7. **Historique des dons** dans `/settings`, sans montant public.
8. **Reçu** par email, avec la mention « don à un service en ligne, non déductible » tant que Q20 n'est pas tranché.

# Ajout aux specs — Captures de chat et add-on WoW (décisions d'Adrien, 23/11/2026)

À intégrer par Claude Code **dans une branche dédiée** `docs/chat-et-addon` (PR de documentation, sans code), après la tâche en cours, puis supprimer ce fichier. Numéros proposés : stories US-83 à US-87, questions Q61 à Q64, tâches T-75 à T-80 ; prendre les prochains libres s'ils sont déjà pris. `pnpm test:trace` doit rester vert.

---

## Partie A — Captures de chat (« Overheard ») [v1.x]

Les captures de chat drôles (canal de groupe, général, commerce, guilde) sont un genre à part : petites images de texte, pas de paysage, et elles contiennent des pseudos d'autres joueurs. Elles ont donc leurs propres règles.

### 1. `docs/04-user-stories.md` — nouvel epic

Carte des epics :

| E-CHAT Captures de chat | Partager les meilleurs moments du chat, sans exposer les autres joueurs | US-83 à US-85 | v1.x (`features.chat`) |

```markdown
## E-CHAT — Captures de chat [v1.x, `features.chat`]

### US-83 [v1.x] Publier une capture de chat
- US-83.1 Given l'upload, When je choisis le type « Chat » (au lieu de « Screenshot », par défaut), Then le formulaire adapte ses champs : titre, version, canal (Party, Raid, Guild, General, Trade, Say/Yell, Whisper, Other), zone facultative, transcription facultative mais recommandée (≤ 2000 caractères) ; les réglages graphiques et le personnage disparaissent.
- US-83.2 Given le type « Chat », When je sélectionne un fichier, Then la taille minimale est 200 px sur le grand côté (au lieu de 640) ; les autres limites (formats, 20 Mo, 7680 px) sont inchangées.
- US-83.3 Given le type « Chat », When le fichier est chargé, Then une étape **« Hide player names »** s'ouvre : je trace des rectangles de masquage (pixellisation ou aplat noir) ; les pixels sont **remplacés dans le navigateur avant l'envoi** (aucune version non masquée n'est transmise). Des zones probables (texte entre crochets `[Nom]`) sont proposées si la détection est disponible (Q62), toujours modifiables.
- US-83.4 Given le type « Chat », When je publie, Then je dois cocher (décochée par défaut) « I hid the names of other players, or they agreed to be shown » ; mon propre pseudo peut rester visible.
- US-83.5 Given le canal « Whisper », When je publie, Then le masquage de tous les noms autres que le mien est obligatoire (au moins un rectangle) et un rappel explique qu'un message privé ne se publie qu'avec l'accord de son auteur.
- US-83.6 Given une transcription saisie, When la capture est publiée, Then elle sert de texte alternatif et est indexée par la recherche ; sans transcription, le texte alternatif est « Chat capture: {titre} ».
- Tests : U (règles par type, limites), composants (masquage destructif des pixels vérifié sur le Blob envoyé), E (publication complète avec masquage).

### US-84 [v1.x] Galerie « Overheard »
- US-84.1 Given `/overheard`, When je l'ouvre, Then seules les captures de type Chat s'affichent, en grille à colonnes fixes (pas de recadrage : l'image entière est toujours visible), triées par récence ou popularité ; filtres : canal, version.
- US-84.2 Given la home, les PLP, la « Capture of the week » et le hero, When elles s'affichent, Then aucune capture de chat n'y apparaît ; la home montre un bloc « Overheard in the chat » de 4 captures de chat populaires avec un lien vers `/overheard`.
- US-84.3 Given une capture de chat, When j'ouvre sa page, Then l'infobulle affiche canal, version, zone et transcription ; « Download original » est remplacé par « Copy image link » ; like, commentaires, partage et signalement fonctionnent comme pour les autres captures.
- US-84.4 Given les qualités, When une capture de chat reçoit des likes, Then elle gagne une qualité selon les mêmes seuils ; le classement (US-22) a un onglet séparé « Funniest chat ».
- Tests : U (exclusions), I, E.

### US-85 [v1.x] Modération des captures de chat
- US-85.1 Given une capture de chat, When elle est traitée, Then en plus de la modération d'image, son texte est analysé (OCR du fournisseur de modération, Q61) : insultes, harcèlement, données personnelles (email, téléphone, adresse, lien) ; un score au-dessus du seuil la met en revue (`pending_review`), jamais en publication directe.
- US-85.2 Given le signalement d'une capture de chat, When un membre la signale, Then le motif « This shows me or another player without consent » est proposé en plus des motifs habituels ; 1 seul signalement de ce motif masque la capture en attendant la revue.
- US-85.3 Given une capture de chat dont un nom reste lisible, When un modérateur la traite, Then il peut la refuser avec le motif « Unmasked player names » ; l'auteur peut republier une version masquée.
- US-85.4 Given les Terms, When ils sont mis à jour, Then ils interdisent les captures de chat visant à moquer ou harceler un joueur identifiable et la publication de messages privés sans accord.
- Tests : U (règles de masquage), I (fournisseur simulé), E.
```

### 2. Autres fichiers
- `03-architecture.md` : `photos.kind` (`screenshot` par défaut, `chat`), `photos.chat_channel`, `photos.transcript` (≤ 2000, indexée en plein texte) ; `photos.min_dimension` dépend de `kind` ; route `/overheard` ; flag `features.chat`.
- `08-securite.md` : masquage destructif côté client (le serveur ne reçoit jamais de pixels non masqués) ; transcription traitée comme texte utilisateur (filtre d'insultes, jamais de HTML).
- `07-design.md` : grille sans recadrage ; badge « Chat » sur la carte ; outil de masquage (rectangles redimensionnables au doigt, cibles ≥ 44 px, annuler/refaire) ; bloc « Overheard in the chat » sur la home.
- `legal/terms.md` et `legal/privacy.md` : règles de US-85.4 ; la transcription est une donnée publique de la capture.

---

## Partie B — Add-on WoW et application compagnon [v1.x]

Un add-on WoW ne peut ni accéder à Internet ni lire ou écrire des fichiers en dehors de son fichier de sauvegarde (SavedVariables), écrit au rechargement de l'interface ou à la déconnexion. D'où un duo : un add-on qui note le contexte de chaque capture, une petite application de bureau qui fait l'envoi.

### 3. `docs/04-user-stories.md` — nouvel epic

| E-COMPANION Add-on et application compagnon | Publier depuis le jeu avec les métadonnées remplies automatiquement | US-86, US-87 | v1.x (`features.companion`) |

```markdown
## E-COMPANION — Add-on et application compagnon [v1.x, `features.companion`]

### US-86 [v1.x] Jetons d'accès personnels
- US-86.1 Given `/settings` › Connected apps, When je crée un jeton pour « Legendary Shots Companion », Then il est affiché une seule fois, limité à la portée `upload` (créer une capture, lire mes captures), avec une date d'expiration (90 jours par défaut) ; seule son empreinte est stockée.
- US-86.2 Given un jeton, When je le révoque, Then toute requête qui l'utilise échoue (401) immédiatement.
- US-86.3 Given un jeton, When il sert, Then la date de dernière utilisation s'affiche dans les réglages ; les quotas d'upload (US-10.5) s'appliquent comme sur le site ; un jeton ne permet ni de liker, ni de commenter, ni de modifier le compte.
- US-86.4 Given l'application compagnon, When je la connecte, Then le parcours privilégié est le **code d'appairage** (l'application affiche un code, je le confirme sur le site connecté) plutôt qu'un jeton copié-collé.
- Tests : U (portée), I (empreinte, révocation, quotas), E.

### US-87 [v1.x] Publier depuis le jeu
- US-87.1 Given l'add-on installé, When je prends une capture en jeu (événement de capture réussie), Then il enregistre dans son fichier de sauvegarde : horodatage, version du jeu, zone et sous-zone, heure en jeu, personnage et classe (si l'option est activée, désactivée par défaut), préréglage graphique si l'API le permet.
- US-87.2 Given l'application compagnon lancée et le dossier de captures du jeu choisi, When un nouveau fichier y apparaît, Then elle l'associe à l'entrée de l'add-on la plus proche dans le temps (±5 s) et l'ajoute à une file « Ready to upload » avec les champs préremplis.
- US-87.3 Given la file, When je choisis une capture, Then je peux la renommer, compléter les champs, choisir le type (Screenshot ou Chat, avec l'étape de masquage de US-83.3), puis l'envoyer ; rien n'est envoyé sans action de ma part.
- US-87.4 Given un envoi, When il aboutit, Then la capture suit le même traitement et la même modération que depuis le site ; l'application affiche le lien vers sa page.
- US-87.5 Given l'add-on, When il est publié, Then il respecte la politique des add-ons de Blizzard (gratuit, code lisible non obfusqué, aucune publicité, aucune automatisation de gameplay) ; il est distribué sur CurseForge et Wago.
- Tests : U (association par horodatage, lecture du fichier de sauvegarde), E (application avec dossier simulé).
```

### 4. Autres fichiers
- `03-architecture.md` : table `personal_access_tokens` (id, user_id, name, token_hash, scopes, created_at, expires_at, last_used_at, revoked_at) ; `POST /api/companion/pair`, `POST /api/companion/pair/confirm` ; les routes d'upload existantes acceptent `Authorization: Bearer` pour la portée `upload` (aucune autre route) ; dépôts séparés `legendary-shots-addon` (Lua) et `legendary-shots-companion` (application de bureau, Q63).
- `08-securite.md` : jetons hachés (SHA-256), portée minimale, expiration, révocation immédiate, limites par jeton ; le jeton n'est jamais accepté par les routes de session ni d'administration ; ajout à la matrice d'autorisation.
- `legal/privacy.md` : l'add-on ne collecte rien hors de l'ordinateur du joueur ; seules les données envoyées volontairement le sont.

---

## 5. `docs/09-questions-ouvertes.md`

| Q61 | Modération du texte dans les captures de chat : le fournisseur actuel propose-t-il l'OCR et la détection d'insultes et de données personnelles, à quel prix ? | Vérifier l'offre du fournisseur ; à défaut, toutes les captures de chat passent en revue humaine pendant la bêta | Ouvert |
| Q62 | Détection automatique des pseudos à masquer (texte entre crochets) dans le navigateur : OCR local (Tesseract.js) ou masquage 100 % manuel ? | Masquage manuel en v1 ; détection en option si un prototype montre < 3 s sur mobile | Ouvert |
| Q63 | Application compagnon : Tauri (léger, Rust) ou Electron ; signature des exécutables Windows et macOS (coût des certificats) | Tauri ; signature à chiffrer | Ouvert — Adrien |
| Q64 | API d'add-on de WoW Forever : événement de capture et accès aux réglages graphiques disponibles ? | À vérifier par un prototype d'add-on avant T-79 | Ouvert |

## 6. `docs/06-plan-de-taches.md` (phase v1.x)

- [ ] **T-75 Captures de chat : type, upload et masquage** (dép. T-58) — US-83. Tests : U, composants, E.
- [ ] **T-76 Galerie Overheard** (dép. T-75) — US-84. Tests : U, I, E.
- [ ] **T-77 Modération des captures de chat** (dép. T-75, Q61) — US-85, Terms. Tests : U, I, E.
- [ ] **T-78 Jetons d'accès personnels et appairage** (dép. T-58) — US-86. Tests : U, I, E.
- [ ] **T-79 Add-on WoW** (dép. T-78, Q64) — dépôt séparé, US-87.1, US-87.5. Tests : U (Lua).
- [ ] **T-80 Application compagnon** (dép. T-78, T-79, Q63) — dépôt séparé, US-87.2 à US-87.4. Tests : U, E. **Action humaine** : comptes CurseForge/Wago, certificats de signature.

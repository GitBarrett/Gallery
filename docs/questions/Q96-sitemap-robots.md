# Q96 — Sitemap et robots (T-35a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-35a (sitemap, robots, contenus retirés), puis T-35b (titre, description, canonique et `hreflang`
    des pages publiques autres que la page photo).
  - **Stockage** : le cron quotidien (3 h 15 UTC) écrit `sitemap.xml` et `sitemap-{n}.xml` dans le bucket privé sous
    `sitemap/` ; les routes les servent (cache 1 h en bordure) et les construisent à la volée tant que le cron n'a pas
    tourné (première mise en production, previews).
  - **Contenu** : l'accueil, les versions non archivées (`/v/{slug}`), les profils des comptes ni bannis ni en
    suppression qui ont au moins une capture publique (dernière modification : leur dernière capture), les captures
    publiques (date de publication). Pas les recherches, pages légales, ni les URL `/fr/…` (le `hreflang` des pages
    les relie, T-35b).
  - **410** : une capture ou un compte supprimé ne laisse aucune ligne ; il répond 404, que US-25.3 accepte (« ou
    410 »). Un 410 demanderait une table des suppressions.
  - **robots.txt** : `/admin`, `/settings`, `/api`, `/upload` et leurs versions `/fr/…` exclus, plus la ligne
    `Sitemap:` ; preview : `Disallow: /` (et `X-Robots-Tag: noindex`, déjà en place). Les autres pages privées
    (« My captures », notifications, connexion) recevront `noindex` dans leur en-tête en T-35b.

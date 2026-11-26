# Q91 — Moteur de recherche (T-33a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-33a (le moteur), T-33c (tolérance aux fautes et recherche sans résultat), puis l'écran T-33b.
  - **Champs cherchés** : titre, description, personnage, zone libre, la zone du dictionnaire que nomme la requête
    (nom anglais, nom français ou alias, à l'identique : « Stormwind », « Hurlevent », « SW »), et les tags nommés par
    la requête entière ou par l'un de ses mots. Pas l'auteur (aucune spec ne le demande), ni la légende.
  - **Mots** : tous les mots de la requête doivent se trouver dans le texte (comme un moteur courant) ; sans
    accents ni majuscules ; pas de racinisation (configuration `simple`, ADR-007 : les noms propres des deux
    langues).
  - **Requête** : caractères de contrôle retirés, coupée à 100 caractères (une requête jusqu'à 2 000 caractères est
    acceptée puis coupée, au-delà 400) ; moins de 2 caractères après nettoyage : aucun résultat, sans erreur.
  - **Tris** : pertinence par défaut (score de l'ADR-007), récence, popularité (likes) ; filtres version et qualité
    minimale comme la galerie. La pertinence pagine par décalage : une capture publiée entre deux pages peut décaler
    un résultat.
  - **Visibilité et cache** : captures publiques seulement (la règle des grilles) ; 60 s de cache en bordure.
  - **Pas de limite de débit** sur cette lecture publique, comme les grilles (Q82) ; à revoir si l'analyse des
    journaux montre des abus.

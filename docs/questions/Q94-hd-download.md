# Q94 — Téléchargement HD : serveur (T-34a)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-34a (serveur : URL signée, compteur, limite, purge), puis T-34b (bouton de la page photo,
    reprise après connexion, Q18).
  - **« Une fois par 24 h » (US-23.1)** : une fois par jour calendaire UTC (clé de la table `downloads`, 03 § Modèle).
    Deux téléchargements à 23 h 50 et 0 h 10 UTC comptent donc deux fois.
  - **Limite de 100/h** : chaque demande d'URL compte, même un téléchargement déjà compté ce jour-là.
  - **L'auteur** qui télécharge sa propre capture est compté comme tout membre (la matrice l'autorise).
  - **Captures publiées seulement** : une capture en revue, masquée ou refusée est introuvable (404), même pour son
    auteur.
  - **Fichier** : nommé `legendary-shots-{id}.{extension}`, du type réellement stocké pour l'original nettoyé (WebP
    sans perte quand il a été converti, Q18) ; aucun texte de l'auteur dans le nom.
  - **Événement analytics `photo_downloaded`** (03) : pas encore émis, aucun suivi d'événements n'existe côté client ;
    à brancher avec le suivi produit.

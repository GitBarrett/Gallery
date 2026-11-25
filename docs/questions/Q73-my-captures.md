# Q73 — Images dans l'interface et « My captures » (T-25b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Adresse et accès** : page privée `/my-captures` (jamais mise en cache par le service worker), un bouton
    « My captures » sur son propre profil à côté de « Settings ». Pas de maquette : design system seul.
  - **Contenu** : toutes les captures dont l'envoi est terminé, de la plus récente à la plus ancienne, 30 par page
    avec « Load more ». Les envois jamais terminés n'apparaissent pas (purgés sous 24 h, US-10.7).
  - **Statuts** : écrits en toutes lettres avec une phrase d'aide (en traitement, en revue, publiée, refusée avec la
    voie de recours, masquée, échec du traitement avec l'invitation à renvoyer le fichier).
  - **Image** : publiée → image publique ; en revue ou masquée → aperçu privé (`?preview=1`) ; en traitement, en
    échec ou refusée (variantes supprimées) → un cadre vide à la taille de l'image. Pas de lien vers la page photo
    tant qu'elle n'existe pas.
  - **Texte alternatif (US-75.3)** : « {titre}, captured by {auteur} » ; la zone s'y ajoutera avec le champ zone de
    l'upload (T-26a), le texte saisi par l'auteur avec son champ.
  - **`sizes` par défaut** de `WowImage` : 4 colonnes dès 1024 px, 3 dès 640 px, sinon 2.
  - **Service worker** : cache `img` pour les largeurs 400, 800 et 1200 sans paramètre (300 entrées, 30 jours,
    purge si le quota est dépassé) ; jamais 2400, `og.jpg`, un aperçu privé ni une autre origine.

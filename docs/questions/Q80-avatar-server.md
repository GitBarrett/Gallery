# Q80 — Avatar : serveur (T-28a)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-28 devient T-28a (serveur) et T-28b (écran : recadrage, réglages, `UiAvatar`).
  - **Fichier** : JPEG, PNG ou WebP, 2 Mo au plus, carré, de 128 à 2048 px de côté ; le recadrage carré se fait dans
    le navigateur (T-28b), le serveur vérifie le fichier déclaré puis le fichier stocké (octets magiques, dimensions).
  - **Version** : un identifiant UUID v7 par nouvel avatar ; `users.avatar_pending_key` tient la version en attente,
    `avatar_key` celle affichée. Un nouvel envoi remplace une version encore en attente.
  - **Quota** : 10 nouveaux avatars par jour et par compte (aucune ligne en 08 § 8).
  - **Décision** : publiée → elle remplace l'avatar affiché, dont les fichiers sont supprimés et les 3 adresses
    purgées ; en revue → l'ancien reste affiché, la version attend un modérateur (T-58) ; refusée → ses fichiers
    sont supprimés ; fichier non conforme ou essais épuisés → « failed ». L'auteur est notifié dans tous les cas.
    Décisions historisées avec `target_type = 'avatar'` et la version en `target_id`.
  - **Service** : `/avatar/{userId}/{version}/{64|128|256}` ne sert que la version affichée (une version en attente,
    ancienne ou inconnue répond 404), un mois en cache immuable.

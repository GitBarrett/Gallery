# Q78 — Modifier et supprimer une capture : serveur (T-27a)

- **Statut** : Tranché — Adrien, 25/11/2026 (options appliquées retenues)
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Découpage** : T-27 devient T-27a (serveur) et T-27b (écran) ; le retrait d'une capture supprimée d'un concours
    (US-12.4) passe dans T-64b et celui des collections dans T-61, ces tables n'existant pas encore.
  - **Modification** : seuls les champs envoyés changent ; un texte vide, une zone ou un point focal `null`
    l'efface ; `tags` remplace la liste. La version du jeu et l'image ne se modifient pas (US-12.1 ne les cite pas).
    Le statut ne change pas, aucune nouvelle modération d'image ; les textes repassent le filtre d'insultes.
  - **Statuts** : toute capture terminée se modifie (publiée, en revue, masquée, refusée, en échec) ; la suppression
    attend la fin du traitement (409 pendant `processing`).
  - **Droits** (annexe B) : l'auteur vérifié ; un suspendu peut supprimer, pas modifier ; la capture d'un autre :
    403 si elle est publiée, 404 sinon ; les modérateurs passeront par les outils de modération (T-58).
  - **Suppression** : l'original et les variantes partent dans `trash/` (30 jours), les 5 adresses `/img` sont purgées
    du cache, puis la ligne est supprimée avec ses détails et ses tags ; une seconde suppression répond 404. Les
    notifications qui citaient la capture ne l'affichent plus (T-23b).
  - **Pas de limite de débit** sur ces deux routes (aucune ligne en 08 § 8).

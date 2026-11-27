# Q101 — Commentaires : écran (T-41b)

- **Statut** : À valider — Adrien
- **Points non précisés par les specs et option appliquée** (la plus simple et réversible) :
  - **Place** : sous les détails de la capture, avant « More from » ; titre « Comments · N » de la maquette.
  - **Visiteur** : un lien « Sign in to comment » qui revient sur la page ; membre non vérifié : « Verify your email to
    comment. » avec le lien de renvoi (US-08.1), sans formulaire.
  - **Suppression** : immédiate, sans demande de confirmation ; à revoir si des suppressions par erreur remontent.
  - **Édition** : le bouton « Edit » disparaît après 15 min (le serveur refuse de toute façon).
  - **Turnstile** : le widget n'apparaît que lorsque le serveur le demande (compte de moins d'un jour), puis l'envoi
    est à refaire.
  - **Compteur** : celui de la page photo (cache d'une minute), sauf quand la liste est complète : elle fait foi.
  - **Liste** : rendue par le serveur, 30 par page, « Load more comments » pour la suite ; le service worker ne la met
    jamais en cache.
  - **Hors ligne** : pas de désactivation du formulaire (03 § PWA) ; l'erreur réseau s'affiche à l'envoi.

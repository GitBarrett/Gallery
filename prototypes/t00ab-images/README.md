# Prototype T-00a / T-00b / T-00c — binding Images et captures 8K

Jetable. Mesure, sur un Worker **distant**, si le binding Images traite une capture 8K de 20 Mo sans erreur mémoire, et combien de temps prennent les 6 variantes (ADR-011, ADR-012).

## Préparer (une fois)

```sh
cd prototypes/t00ab-images
npx wrangler login                    # autorise wrangler sur le compte Cloudflare
npx wrangler r2 bucket create ls-proto
npx wrangler secret put PROTO_TOKEN   # saisir une longue valeur aléatoire
npx wrangler deploy                   # affiche l'URL https://ls-proto-images.<compte>.workers.dev
```

R2 demande d'ajouter un moyen de paiement dans le tableau de bord, même pour l'offre gratuite. Le plan Workers Paid (5 $/mois) est recommandé : le plan gratuit limite le CPU à 10 ms par requête, ce qui fausserait les mesures.

## Mesurer

```sh
URL=https://ls-proto-images.<compte>.workers.dev
TOKEN=<la valeur de PROTO_TOKEN>

# T-00a / T-00b : une capture 8K
curl -X PUT -H "Authorization: Bearer $TOKEN" --data-binary @capture-8k.jpg $URL/upload/8k.jpg
curl -X POST -H "Authorization: Bearer $TOKEN" "$URL/process?keys=8k.jpg"

# T-00c : trois PNG 5120×2160 en parallèle
curl -X POST -H "Authorization: Bearer $TOKEN" "$URL/process?keys=a.png,b.png,c.png"
```

Logs en direct, dont une éventuelle erreur « exceeded memory » : `npx wrangler tail`.

## Critères (docs/06-plan-de-taches.md)

- **T-00a** : aucune erreur mémoire sur 20 Mo. Repli : limite sous 20 Mpx côté serveur, conversion navigateur au-delà.
- **T-00b** : les 6 variantes sont produites pour un JPEG 8K. Repli : réduire les largeurs, ou deux étapes.
- **T-00c** : moins de 30 s par capture, aucune erreur. Repli : traitement séquentiel.

Le Worker n'expose pas sa consommation mémoire : on juge sur l'absence d'erreur, pas sur un chiffre.

## Nettoyer

```sh
npx wrangler delete
npx wrangler r2 bucket delete ls-proto   # après avoir vidé le bucket
```

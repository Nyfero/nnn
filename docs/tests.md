# Tests

| Niveau | Commande | Prérequis | Couvre |
|---|---|---|---|
| Unitaires + interopérabilité | `npm test` | `npm install` | crypto client ↔ serveur, SDK serveur, validation, JWT, rate limit, emails |
| Build | `npm run build` | `npm install` | compilation des deux frontends |
| Bout en bout | `npm run test:e2e` | stack lancée en mode E2E | parcours complet sur la vraie pile (Caddy, core, module, bases) |

## Tests unitaires (`npm test`)
Aucune base ni Docker requis. `npm test` lance les tests de chaque workspace ; pour un seul : `npm test -w modules/passwords/backend`.
Chaque module a ses tests (backend en `test/*.test.ts` via `tsx`, frontend en `test/*.test.mjs` pour la logique JS pure). La logique testable vit dans des fichiers sans Prisma ni Vue (`src/utils/`), les routes et composants ne font que l'assembler. Voir le skill `module-tests` (`.claude/skills/`).

- `packages/sdk/test/vault.test.mjs` : une clé maître chiffrée côté navigateur est lisible côté serveur et inversement (le seed admin) ; changement de mot de passe, récupération par réponses, dérivation HKDF par module.
- `packages/sdk/test/server.test.mjs` : `coreAuth` (accepté, refusé, 403, cache, core injoignable), `registerModule`, `requireModuleSecret`, contre un faux core.
- `core/backend/test/` :
  - `validators.test.ts` : formats des blobs et sels, 3 questions exactement, normalisation des réponses identique client/serveur, cohérence des durées de vie.
  - `crypto-jwt.test.ts` : signature JWT (falsification, mauvaise clé, algorithmes `none`, HS256 et RS384 refusés, expiration), jetons opaques, KEK et blob de clé maître au même format que le client.
  - `access.test.ts` : accès aux modules par rôles (liste blanche, « tous sauf », exceptions individuelles, cumul), quotas, rôles par défaut, authentification module -> core (`moduleAuth`).
  - `rateLimit-email.test.ts` : rate limit, échappement HTML des emails, variables des modèles d'email.
- `modules/passwords/` : backend `validation.test.ts` (corps des requêtes, domaine des logos, pas d'injection de `user_id`) ; frontend `crypto.test.mjs` (AES-GCM : IV aléatoire, mauvaise clé, chiffré modifié) et `passwordsList.test.mjs` (filtre, regroupement, domaines).
- `modules/servers/` : backend `docker.test.ts` (client Docker contre un faux proxy local : conteneurs Myprout protégés, délai d'arrêt, Docker injoignable), `validation.test.ts`, `access.test.ts` (visibilité par utilisateur, admin requis) ; frontend `serverState.test.mjs` (états affichés, durée de fonctionnement).
- `modules/files/` : backend `units.test.ts`, frontend `vault.test.mjs`.

## Tests de bout en bout (`npm run test:e2e`)
26 étapes enchaînées sur la vraie pile :

1. inscription, vérification d'email, validation par l'admin, activation (clé maître créée **côté client**) ;
2. connexion, cookie de refresh `HttpOnly` / `SameSite=Strict`, routes admin protégées ;
3. accès aux modules : refusé, puis accordé par l'admin, lobby ;
4. module passwords : données chiffrées côté client (le serveur ne voit jamais le secret), CRUD, favoris, **isolation entre comptes**, logo, routes internes bloquées par le proxy ;
5. sessions : rotation du refresh token, tolérance de 30 s, révocation (core immédiat, module après le cache de 5 s) ;
6. changement de mot de passe : même clé maître, autres appareils déconnectés, données toujours lisibles ;
7. mot de passe oublié : pas d'énumération, questions de sécurité obligatoires, clé maître retrouvée côté client, lien à usage unique, sessions révoquées ;
8. suppression de compte : admin protégé, mot de passe exigé, **données du module purgées**.

Le test crée un compte `e2e+<aléa>@example.test` et le supprime à la fin. Il désactive temporairement « Accès auto » du module passwords, puis le rétablit.

### Lancer les tests
```bash
# 1. Dans .env : un jeton pour la boîte mail de test
#    E2E_TOKEN=$(openssl rand -hex 16)

# 2. Démarrer la pile en mode E2E (emails capturés en mémoire, rate limit désactivé)
docker compose -f docker-compose.yml -f docker-compose.dev.yml -f docker-compose.e2e.yml up -d --build
docker compose ps                  # attendre que core-backend et passwords-backend soient "healthy"

# 3. Lancer (Node >= 20.6, ADMIN_EMAIL / ADMIN_PASSWORD lus dans .env)
npm install
npm run test:e2e

# 4. Revenir à la normale
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --force-recreate core-backend
```
`docker-compose.dev.yml` expose le module sur `127.0.0.1:3001` : c'est ce qui permet de vérifier la purge des données à la suppression d'un compte (sinon cette seule vérification est ignorée, avec un avertissement).

Variables optionnelles : `E2E_BASE_URL` (défaut `http://localhost`, par exemple `http://localhost:8080` si vous avez changé le port), `PASSWORDS_INTERNAL_URL` (défaut `http://127.0.0.1:3001`).

### Sécurité du mode E2E
- Il n'existe que si `E2E_MODE=true` ; le core **refuse de démarrer** si ce mode est combiné à `NODE_ENV=production` ou sans `E2E_TOKEN`.
- La boîte mail de test exige l'en-tête `X-E2E-Token`.
- Ne l'utilisez que sur une instance de développement : ce mode désactive le rate limit.

### Si un test échoue
| Message | Cause probable |
|---|---|
| « Boîte mail E2E inaccessible » | pile lancée sans `docker-compose.e2e.yml`, ou `E2E_TOKEN` différent de celui du conteneur |
| « Aucun mail … reçu » | template HTML manquant dans `core/backend/src/services/email/template/` (voir `docker compose logs core-backend`) |
| « le module passwords doit s'être enregistré » | secret `MODULE_SECRET_PASSWORDS` incohérent, ou migration du module non générée |
| Étape 6 (connexion admin) en 401 | `ADMIN_PASSWORD` du `.env` ne correspond plus à celui de la base (admin créé avec un autre mot de passe) |
| `ECONNREFUSED` | pile arrêtée, ou port du proxy différent (`E2E_BASE_URL`) |

## Ce qui n'est pas couvert
- **L'interface dans un navigateur** (clics, rendu, IndexedDB réel) : les tests rejouent le code client dans Node, pas le DOM.
- **L'envoi réel via Resend** et le rendu des templates de production.
- **Le HTTPS** et les cookies `Secure` (mode `NODE_ENV=production`).
- **Plusieurs instances** du core (le rate limit et le cache d'autorisation sont en mémoire).

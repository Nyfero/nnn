# Architecture Myprout

## Principes

- Un **core** (identité, accès, lobby, profil, admin) et des **modules** indépendants.
- Chaque brique est un conteneur Docker. Chaque module a sa propre BDD.
- Une seule origine publique (Caddy) : `/` = core, `/<module>` = frontend du module,
  `/api/core/*` = API core, `/api/<module>/*` = API du module.
- Le core ne connaît que `user_id`. Les modules ne lisent jamais la BDD du core.

## Contrat d'un module

| Élément          | Convention                                                                            |
| ---------------- | ------------------------------------------------------------------------------------- |
| Frontend         | servi sur `/<id>/` (Vite `base: '/<id>/'`), conteneur nginx port 80                   |
| Backend          | port 3000, routes sous `/api/<id>/`                                                   |
| Services compose | `<id>-backend`, `<id>-frontend`, `<id>-db`                                            |
| Variables        | `CORE_URL`, `MODULE_ID`, `MODULE_NAME`, `MODULE_ICON`, `MODULE_PATH`, `MODULE_SECRET` |
| Enregistrement   | `POST {CORE_URL}/api/core/modules/register` au démarrage (header `X-Module-Secret`)   |
| Auth             | `POST {CORE_URL}/api/core/introspect` avec le Bearer de l'utilisateur                 |
| Crypto           | clé dérivée de la clé maître : `HKDF(master_key, "module:<id>")`                      |

## Ajouter un module

1. Créer `modules/<id>/{backend,frontend}` avec leurs Dockerfile.
2. Ajouter les services `<id>-*` dans `docker-compose.yml`.
3. Ajouter un bloc `handle /<id>*` et `handle /api/<id>/*` dans `proxy/Caddyfile`.
4. Ajouter `MODULE_SECRET_<ID>` dans `.env` et dans le service `core-backend`.

## Clé maître (zero-knowledge)

- Générée côté client à l'activation du compte.
- Stockée en base (core) sous deux blobs : chiffrée par la KEK (mot de passe) et par la KEK de récupération.
- Après login : importée dans IndexedDB en `CryptoKey` HKDF non extractable, supprimée au logout/inactivité.
- Changement de mot de passe ou reset : seul le blob du core est rechiffré.

## Background partagé

`DustParticles` vit dans `@myprout/ui`. Le core et chaque module le montent dans leur `App.vue`,
ce qui garantit un fond identique partout. Core et modules étant des applications distinctes,
l'animation redémarre au changement d'application (positions aléatoires : l'effet est quasi invisible).

## API du core (`/api/core`)

| Route                                                                                                        | Accès                | Rôle                                                               |
| ------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------------------------ |
| `POST /auth/register`, `/verify-email`, `/activate`                                                          | public               | inscription, activation (le client envoie les blobs de clé maître) |
| `POST /auth/login`, `/refresh`, `/logout`                                                                    | public               | sessions (cookie refresh limité à `/api/core/auth`)                |
| `PUT /auth/password`, `POST /auth/password/verify`                                                           | user                 | changement de mot de passe (blob rechiffré par le client)          |
| `POST /auth/password/forgot`, `GET /auth/recovery`, `POST /auth/recovery/verify`, `PUT /auth/password/reset` | public               | reset en 3 étapes                                                  |
| `DELETE /auth/account`                                                                                       | user                 | suppression ; le core prévient les modules                         |
| `GET /modules`                                                                                               | user                 | lobby : modules accessibles                                        |
| `POST /modules/register`                                                                                     | module               | auto-enregistrement                                                |
| `POST /introspect`                                                                                           | module + Bearer user | validation du token et de l'accès au module                        |
| `/admin/*`                                                                                                   | admin                | inscriptions, utilisateurs, accès par module, modules              |

Un module expose `DELETE /api/<id>/internal/users/:user_id` (header `X-Module-Secret`) pour purger les données d'un utilisateur supprimé.

## Frontend du core

Routes : `/login` (connexion, inscription, activation, reset), `/` (lobby), `/profile`, `/admin` (inscriptions, accès aux modules, modules), `/unlock`.

### Convention de redirection (core <-> modules)

- Utilisateur non connecté dans un module : redirection vers `/login?redirect=/<module>/`. Après connexion, retour au module.
- Clé maître absente de ce navigateur (IndexedDB vidée) : redirection vers `/unlock?redirect=/<module>/`.
- Le paramètre `redirect` n'accepte que des chemins locaux (pas d'URL externe).

### Clé maître côté client (`@myprout/sdk/client`)

| Moment                     | Opération                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Activation                 | `createVault(password, answers)` : génère la clé maître, la chiffre avec la KEK du mot de passe et celle des réponses                 |
| Login                      | `unlockMasterKey(password, user)` : déchiffre, importe en `CryptoKey` HKDF non extractable, stocke dans IndexedDB (liée au `user_id`) |
| Module                     | `getModuleKey(moduleId, userId)` : `HKDF(master_key, "module:<id>")` -> clé AES-GCM du module                                         |
| Changement de mot de passe | `rewrapForNewPassword(old, new, user)` : seul le blob du core change                                                                  |
| Reset                      | `recoverMasterKeyHex(answers, blobs)` puis `wrapMasterKey(hex, newPassword)`                                                          |
| Logout / inactivité        | `clearMasterKey()`                                                                                                                    |

Test d'interopérabilité client <-> serveur : `npm test -w packages/sdk`.

## Module passwords

- **Backend** (`/api/passwords`) : `coreAuth` (SDK) valide chaque requête auprès du core ; ses données sont dans sa propre base, rattachées au seul `user_id`.
- **Frontend** (`/passwords/`) : au démarrage il récupère la session (cookie de refresh du core), vérifie l'accès, dérive sa clé AES depuis la clé maître (IndexedDB), puis monte l'interface. Sinon il redirige vers `/login` ou `/unlock` avec `?redirect=/passwords/`.
- **Chiffrement** : les mots de passe sont chiffrés dans le navigateur (AES-GCM, clé `HKDF(master_key, "module:passwords")`). Le serveur ne stocke que du chiffré.
- **Suppression de compte** : le core appelle `DELETE /api/passwords/internal/users/:id` (secret du module) pour purger les données.
- **Développement** : l'enchaînement core -> module (redirections /login, /unlock) suppose une seule origine ; testez le module via `docker compose` (Caddy) plutôt qu'avec deux serveurs Vite séparés.

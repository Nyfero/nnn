---
name: new-module
description: Crée un nouveau module Myprout (backend + frontend + base MySQL + Docker + proxy + secret + sauvegarde + tests) conforme au contrat de docs/architecture.md. À utiliser quand l'utilisateur veut ajouter un module à la plateforme.
---

# Créer un nouveau module

Un module est une application indépendante branchée sur le core. `modules/passwords` est le modèle de référence ; `modules/files` montre comment tester. Lire `docs/architecture.md` (contrat) et `docs/deploiement.md` §9 avant de commencer.

## 0. Cadrage (demander si non précisé)

- `<id>` : minuscules, sans espace (ex. `notes`). Nom affiché, icône Material (`MODULE_ICON`), rôle(s) qui y accèdent par défaut.
- Quelles données sont stockées, et lesquelles doivent être **chiffrées côté navigateur** (par défaut : toutes les données utilisateur).
- Travailler sur une branche dédiée `module/<id>` (jamais directement sur `main`).

## 1. Code

Copier `modules/passwords/{backend,frontend}` vers `modules/<id>/` puis remplacer `passwords` / `Passwords` / le nom affiché partout (package.json `@myprout/<id>-backend|frontend`, Dockerfile, nginx.conf, vite.config.js, index.html, stores, etc.). Ne pas copier `node_modules`.

Backend (`modules/<id>/backend`) :

- `src/index.ts` : `coreAuth(...)` sur les routes utilisateur, `registerModule(...)` au démarrage, route `GET /api/<id>/health`, route interne `DELETE /api/<id>/internal/users/:user_id` protégée par `requireModuleSecret` qui purge **toutes** les données de l'utilisateur.
- `prisma/schema.prisma` : tables propres au module, chaque table avec `user_id`. Aucune référence à la base du core.
- Toutes les requêtes Prisma filtrent par `req.user` (isolation entre comptes). Valider les entrées.
- Mettre la logique pure (validation, formats, calculs) dans `src/utils/` ou `src/services/` pour pouvoir la tester sans base.

Frontend (`modules/<id>/frontend`) :

- Vite avec `base: '/<id>/'`, port de dev libre (vérifier `grep -rn "port:" modules/*/frontend/vite.config.js core/frontend/vite.config.js`).
- `src/main.js` : même démarrage que passwords (`refreshSession`, `redirectToLogin`, `getModuleKey('<id>', userId)`, `redirectToUnlock`).
- Chiffrement dans le navigateur avec la clé du module ; le serveur ne reçoit que du chiffré.

## 2. Points d'intégration à modifier (ne rien oublier)

| Fichier                   | Modification                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`      | services `<id>-db`, `<id>-backend`, `<id>-frontend` (copier les blocs `passwords-*`), réseau `<id>-internal`, volume `<id>_db_data`, et `MODULE_SECRET_<ID>` dans l'environnement de `core-backend` |
| `docker-compose.dev.yml`  | ports locaux : base `127.0.0.1:<port-libre>:3306` (suite de 3307-3310), backend `127.0.0.1:<port-libre>:3000` (suite de 3000-3003)                                                                  |
| `proxy/Caddyfile`         | `handle /api/<id>/*` vers `<id>-backend:3000` et bloc `@<id> path /<id> /<id>/*` vers `<id>-frontend:80`                                                                                            |
| `.env.example`            | `MODULE_SECRET_<ID>`, `<ID>_DB_NAME`, `<ID>_DB_USER`, `<ID>_DB_PASSWORD`, `<ID>_DB_ROOT_PASSWORD` (valeurs factices)                                                                                |
| `scripts/backup.sh`       | ligne `dump <id>-db "$OUT/<id>.sql.gz"`                                                                                                                                                             |
| `scripts/restore.sh`      | fichier `<id>.sql.gz` dans la vérification, ligne `restore <id>-db …`, ajouter `<id>-backend` à la variable `BACKENDS`                                                                              |
| `scripts/migrate-init.sh` | bloc `→ <id>` avec le port de dev de la base                                                                                                                                                        |
| `package.json` (racine)   | `<id>` dans les scripts `test` (workspaces testés) et `build` (frontend)                                                                                                                            |
| `docs/`                   | `docs/module-<id>.md` (rôle, API, sécurité, tests) ; ajouter le module à la liste de `README.md` / `docs/architecture.md` si pertinent                                                              |

Le secret réel (`openssl rand -hex 32`) va dans le `.env` de l'utilisateur : ne pas toucher à `.env`, lui indiquer la commande. Le core retrouve le secret par la variable `MODULE_SECRET_<ID>` (id en majuscules, `-` remplacé par `_`).

## 3. Migrations

Générer la migration initiale avec le skill `db-migration` (jamais à la main) et la commiter.

## 4. Tests (obligatoire)

Appliquer le skill `module-tests` : au minimum des tests unitaires de la validation des entrées et des utilitaires du backend, et de la logique de chiffrement/formatage du frontend. Ajouter le script `test` dans les `package.json` du module et dans le `test` racine.

## 5. Vérification

1. `npm install` (met à jour `package-lock.json`, à commiter).
2. `npm test`, `npm run typecheck -w modules/<id>/backend`, `npm run build -w modules/<id>/frontend`.
3. `docker compose config -q` pour valider le compose (nécessite un `.env`).
4. Lancer le skill `pre-merge-check`, puis demander à l'utilisateur de tester le module via `docker compose up -d --build` (une seule origine : passer par Caddy, pas par deux serveurs Vite).

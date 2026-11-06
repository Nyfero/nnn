# Myprout — mémoire du projet

Plateforme modulaire auto-hébergée : un **core** (comptes, lobby, profil, admin) sur lequel se branchent des **modules** indépendants (passwords, files, servers…). Tout tourne sous Docker derrière Caddy.
Détails : `docs/architecture.md` (contrat des modules), `docs/tests.md`, `docs/deploiement.md`, `docs/module-*.md`.

## Stack
- Frontend : Vue 3 + Vite + Pinia (JavaScript, alias `@` -> `src/`). Thème et composants partagés dans `packages/ui`.
- Backend : Node 22, Express, TypeScript exécuté par `tsx`, Prisma 6, MySQL 8.4 (une base par brique).
- Monorepo npm workspaces : `packages/*`, `core/*`, `modules/*/*`.
- Client du core et crypto partagés : `packages/sdk` (`@myprout/sdk`, `/server` et `/client`).

## Structure
- `core/{backend,frontend}` : identité, rôles, lobby, admin.
- `modules/<id>/{backend,frontend}` : un module = un backend + un frontend + une base MySQL propre.
- `proxy/Caddyfile` : `/` = core, `/<id>` = frontend du module, `/api/core/*` et `/api/<id>/*` = APIs.
- `e2e/` : tests de bout en bout sur la vraie pile. `scripts/` : gen-keys, migrate-init, backup, restore.
- Ports de dev (`docker-compose.dev.yml`) : core 3000, passwords 3001, servers 3002, files 3003 ; bases 3307 à 3310.

## Commandes
- Tests unitaires (sans Docker) : `npm test` (ou `npm test -w <workspace>`, ex. `-w modules/files/backend`).
- Types d'un backend : `npm run typecheck -w <modules/x/backend>`.
- Build des frontends : `npm run build` (ou `-w <workspace>`).
- E2E : `npm run test:e2e` (pile lancée avec `docker-compose.e2e.yml`, voir `docs/tests.md`).
- Pile de dev : `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
- Ne jamais utiliser `docker-compose.dev.yml` / `.e2e.yml` en production.

## Règles d'architecture (ne pas contourner)
- Le core ne connaît que `user_id`. **Un module ne lit jamais la base du core ni celle d'un autre module.**
- Un module = backend sur le port 3000 routes `/api/<id>/…`, frontend Vite `base: '/<id>/'`, services compose `<id>-backend|frontend|db`, variables `CORE_URL`, `MODULE_ID`, `MODULE_NAME`, `MODULE_ICON`, `MODULE_PATH`, `MODULE_SECRET`.
- Backend : `coreAuth(...)` sur toutes les routes utilisateur, `registerModule(...)` au démarrage, `DELETE /api/<id>/internal/users/:user_id` protégé par `requireModuleSecret` pour purger les données d'un compte supprimé.
- Les routes `/api/*/internal/*` sont bloquées par Caddy : elles ne servent qu'aux appels entre services.
- Chaque donnée est rattachée à `user_id` et **toujours filtrée par `user_id`** côté backend (isolation entre comptes).

## Sécurité (zero-knowledge)
- Les données sensibles sont chiffrées **dans le navigateur** (AES-GCM, clé `getModuleKey('<id>', userId)` dérivée de la clé maître). Le serveur ne stocke que du chiffré et ne reçoit jamais de clair ni de clé.
- Jamais de secret, mot de passe ou clé dans le code, les logs ou les tests. `.env` et `secrets/` ne sont jamais lus, modifiés ni commités (seul `.env.example` l'est).
- Ne jamais monter `/var/run/docker.sock` dans un service applicatif (le module servers passe par `docker-proxy`).
- Valider toute entrée côté backend (types, longueurs, entiers positifs pour les ids).

## Base de données et migrations
- Les migrations Prisma sont **générées** (`prisma migrate dev`) puis **commitées** ; une migration déjà appliquée ne se modifie jamais. Voir le skill `db-migration`.
- En production, le conteneur exécute `prisma migrate deploy` au démarrage : sauvegarder (`scripts/backup.sh`) avant tout déploiement avec migration.

## Tests
- Chaque module doit avoir ses tests unitaires : `node:test` + `assert/strict`, backend en `test/*.test.ts` (via `tsx`), frontend en `test/*.test.mjs` pour la logique JS pure. Voir le skill `module-tests`.
- Un bug corrigé = un test qui échoue avant la correction et passe après.
- Les tests unitaires n'utilisent ni Docker ni base de données : isoler la logique pure (utils, validators, services) pour la tester.
- Le script `test` du `package.json` racine liste les workspaces testés : y ajouter tout nouveau module.

## Workflow Git
- `main` = version stable, toujours déployable. Une branche par module ou par sujet : `module/<id>` (création/évolution d'un module), `core/<sujet>`, `fix/<sujet>`.
- Une branche ne touche qu'un module (plus `packages/*` ou le core si indispensable) pour ne pas mélanger les modules.
- Avant de fusionner dans `main` : skill `pre-merge-check`. Ne jamais fusionner, pousser ni forcer sans demande explicite.
- Messages de commit en français, à l'impératif court (ex. « Ajoute la corbeille au module files »).

## Style
- Commentaires, messages d'erreur et textes d'interface en **français**. Noms de code en anglais.
- Imiter l'existant : prendre `modules/passwords` comme modèle de référence (le plus simple) et `modules/files` pour les tests.
- Ne pas ajouter de dépendance sans la justifier ; préférer l'API Node/Web native.

## Skills et agents du projet
- `new-module` : créer un module conforme au contrat (code, compose, proxy, secrets, sauvegarde, tests).
- `module-tests` : écrire ou compléter les tests unitaires d'un module.
- `db-migration` : modifier un schéma Prisma et générer la migration proprement.
- `pre-merge-check` : contrôle complet avant de fusionner une branche dans `main`.
- Agent `module-reviewer` : relecture d'un module (contrat, isolation des données, zero-knowledge).

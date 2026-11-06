---
name: pre-merge-check
description: Contrôle complet d'une branche (tests, types, build, migrations, secrets, contrat des modules, doc) avant de la fusionner dans main pour garder une version stable. À utiliser quand l'utilisateur veut finaliser ou fusionner une branche.
---

# Contrôle avant fusion dans `main`

`main` doit rester stable et déployable. Ce skill vérifie, il ne fusionne ni ne pousse rien sans demande explicite.

## 1. Périmètre
- `git status` et `git branch --show-current` : refuser de continuer sur `main` ; signaler les fichiers non commités.
- `git diff --stat main...HEAD` : lister les briques touchées. Une branche de module ne devrait toucher que `modules/<id>/` (plus les points d'intégration listés dans le skill `new-module`). Signaler tout mélange de modules.

## 2. Vérifications automatiques (lancer et rapporter chaque résultat)
1. `npm test` — tous les tests unitaires.
2. `npm run typecheck -w <backend>` pour chaque backend touché (core et modules).
3. `npm run build` — compilation de tous les frontends.
4. Si le compose, le Caddyfile ou l'ajout d'un module est concerné : `docker compose config -q` (si un `.env` existe).
5. E2E (`npm run test:e2e`) : seulement si la pile est déjà lancée en mode E2E ; sinon rappeler à l'utilisateur la procédure de `docs/tests.md`.

## 3. Contrôles par lecture du diff
- **Tests** : toute logique modifiée ou ajoutée a un test (skill `module-tests`) ; un module sans test est un point bloquant.
- **Migrations** : si `schema.prisma` a changé, une migration correspondante est dans le diff, jamais une migration existante modifiée.
- **Secrets** : aucun `.env`, clé, mot de passe, token dans le diff ; `.env.example` ne contient que des valeurs factices.
- **Contrat** : isolation par `user_id`, route interne de purge, `coreAuth`, chiffrement côté client, pas de lecture de la base d'un autre module, pas de `docker.sock` monté (voir `CLAUDE.md`).
- **Intégration d'un nouveau module** : compose, Caddyfile, `.env.example`, `backup.sh`, `restore.sh`, `migrate-init.sh`, scripts `test`/`build` racine, `docs/module-<id>.md`.
- **Doc** : `docs/` et `README.md` à jour si le comportement, l'API ou les commandes changent.

Pour une relecture approfondie d'un module, déléguer à l'agent `module-reviewer`.

## 4. Rapport
Donner un verdict clair : **prêt à fusionner** ou **bloquants** (liste courte, avec fichier et correction proposée), puis les points non bloquants. Si tout est vert, proposer les commandes de fusion (`git checkout main && git merge --no-ff <branche>`) sans les exécuter, et rappeler `./scripts/backup.sh` avant un déploiement avec migration.

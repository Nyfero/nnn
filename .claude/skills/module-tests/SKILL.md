---
name: module-tests
description: Écrit ou complète les tests unitaires d'un module Myprout (backend TypeScript ou frontend JS) pour limiter les régressions, et les branche sur `npm test`. À utiliser après toute modification de logique, lors d'un bug corrigé ou à la création d'un module.
---

# Tests unitaires d'un module

## Conventions du dépôt
- Runner : `node:test` + `node:assert/strict`. Pas de Jest/Vitest installé.
- Backend : `modules/<id>/backend/test/*.test.ts`, lancés par `tsx --test --test-force-exit test/*.test.ts`. Imports relatifs sans extension (`../src/utils/names`).
- Frontend : `modules/<id>/frontend/test/*.test.mjs`, lancés par `node --test test/*.test.mjs`, pour la logique JS **pure** (utils, crypto, formats). Le DOM n'est pas testé.
- Paquets partagés : `packages/sdk/test/*.test.mjs` (crypto client↔serveur, `coreAuth` contre un faux core).
- Exemples à imiter : `modules/files/backend/test/units.test.ts`, `modules/files/frontend/test/vault.test.mjs`, `packages/sdk/test/server.test.mjs`.
- Aucun test unitaire n'utilise Docker, MySQL, le réseau réel ni un `.env`. Le parcours complet sur la vraie pile relève de `e2e/`.

## Méthode
1. Lire le code du module et lister la logique **pure** : validateurs, nettoyage de noms/entrées, calculs (quota, tailles), signatures/jetons, chiffrement, mapping de données.
2. Si une logique est enfouie dans une route avec Prisma, l'extraire dans `src/utils/` ou `src/services/` (fonction qui reçoit ses dépendances en paramètres) avant de la tester. Garder le changement minimal et ne pas modifier le comportement.
3. Écrire les tests, en français pour les titres (`test('cleanName : refuse chemins et caractères de contrôle', …)`).
4. Lancer `npm test -w modules/<id>/backend` (et `/frontend`), puis `npm test`.

## Ce qu'il faut couvrir en priorité
- **Entrées invalides** : types incorrects, chaînes vides ou trop longues, ids non entiers ou négatifs, valeurs `null`/`undefined`. Chaque validateur refuse le mauvais et accepte le bon.
- **Frontières** : tailles limites, expiration (injecter l'heure `now` plutôt que `Date.now()`), quotas à la limite.
- **Isolation entre utilisateurs** : toute fonction qui construit une condition ou une requête doit prouver qu'elle est restreinte à `user_id`.
- **Sécurité** : falsification d'un jeton/ticket, mauvaise clé, chiffrement lisible uniquement avec la bonne clé, IV aléatoire, rien de sensible en clair dans les sorties.
- **Régression** : pour un bug corrigé, un test qui échoue sur l'ancien code et passe sur le nouveau.

## Brancher le module sur `npm test`
1. Ajouter dans le `package.json` du workspace : `"test": "tsx --test --test-force-exit test/*.test.ts"` (backend) ou `"test": "node --test test/*.test.mjs"` (frontend). `tsx` est déjà en devDependency des backends.
2. Ajouter le workspace au script `test` du `package.json` racine (`npm test -w … -w modules/<id>/backend`).
3. Ne pas déclarer un script `test` sans fichier de test : `tsx --test test/*.test.ts` échoue quand le dossier est vide (c'est le cas actuel de `core/backend`).

## Composants Vue
Pas de framework de test de composants dans le dépôt. Ne tester que la logique JS extraite (composables, utils). Si l'utilisateur veut tester les composants, proposer Vitest + `@vue/test-utils` et attendre son accord avant d'ajouter la dépendance.

## Fin
Résumer : fichiers de test ajoutés, ce qui est couvert, ce qui ne l'est pas, et le résultat de `npm test`.

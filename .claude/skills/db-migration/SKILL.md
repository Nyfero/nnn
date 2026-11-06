---
name: db-migration
description: Modifie le schéma Prisma d'un module ou du core et génère la migration MySQL correspondante de façon sûre. À utiliser pour toute évolution de base de données (nouvelle table, colonne, index, contrainte).
---

# Migration de base de données (Prisma + MySQL)

Chaque brique a sa base et son schéma : `core/backend/prisma/schema.prisma`, `modules/<id>/backend/prisma/schema.prisma`. Ne jamais toucher à la base d'une autre brique.

## Règles
- Les migrations sont **générées** par `prisma migrate dev`, puis **commitées**. Ne pas écrire ni éditer `prisma/migrations/**` à la main (un hook le refuse) ; une migration déjà appliquée ne change jamais, on en crée une nouvelle.
- Les migrations s'appliquent en production au démarrage du conteneur (`prisma migrate deploy`) : elles doivent être sûres sur des données existantes.
- Changement destructif (suppression ou renommage de colonne/table, réduction de type, nouvelle contrainte `NOT NULL`/`UNIQUE` sur des lignes existantes) : l'annoncer à l'utilisateur et obtenir son accord ; préférer une migration en deux temps (ajout, copie des données, suppression plus tard).
- Aucune donnée en clair ajoutée au schéma d'un module zero-knowledge : les colonnes sensibles stockent du chiffré (texte/blob) et le `user_id` reste présent et indexé.

## Procédure
1. Modifier `schema.prisma` (modèle, `@@index`, relations restant internes au module).
2. Démarrer la base de dev avec les ports locaux : `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d <brique>-db` (ports : core 3307, passwords 3308, servers 3309, files 3310, suivants selon `docker-compose.dev.yml`).
3. Générer la migration avec le compte root (Prisma a besoin d'une base « shadow »), sans lire ni afficher le `.env` :
   `./scripts/migrate-init.sh <nom>` génère pour **toutes** les briques ; pour une seule brique, reproduire son bloc : `DATABASE_URL=mysql://root:<mdp-root-encodé>@127.0.0.1:<port>/<base> npx prisma migrate dev --name <nom> --schema modules/<id>/backend/prisma/schema.prisma`. Le mot de passe est dans le `.env` de l'utilisateur : lui faire lancer la commande si Claude n'y a pas accès.
4. Relire le SQL généré (`migration.sql`) : pas de `DROP` inattendu, valeurs par défaut pour les colonnes ajoutées sur une table non vide.
5. `npx prisma generate --schema …` si besoin, puis `npm run typecheck -w <backend>` et `npm test`.
6. Mettre à jour le code, les tests (skill `module-tests`) et la doc `docs/module-<id>.md` si le modèle de données change.
7. Commiter ensemble `schema.prisma` et le dossier de migration.

## Déploiement
Rappeler à l'utilisateur de lancer `./scripts/backup.sh` avant de déployer une migration, et que le retour arrière d'une migration de données passe par la restauration (`docs/deploiement.md` §5 et §6).

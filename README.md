# Myprout

Plateforme modulaire auto-hébergée : un **core** (comptes, lobby, profil, admin) sur lequel se branchent des **modules** Docker.

```
myprout/
├── docker-compose.yml
├── proxy/                 # Caddy (point d'entrée unique)
├── packages/
│   ├── ui/                # thème CSS, composants Vue et background partagés
│   └── sdk/               # client du core, introspection, crypto partagée
├── core/{backend,frontend}
├── modules/passwords/{backend,frontend}
├── e2e/                   # tests de bout en bout (npm run test:e2e)
├── scripts/               # gen-keys, migrate-init, backup, restore
└── docs/                  # architecture, tests, deploiement
```

## Démarrage (phase 1)

```bash
cp .env.example .env        # puis éditer les mots de passe
./scripts/gen-keys.sh       # clés JWT RS256
docker compose up -d proxy core-db passwords-db
```

Les services applicatifs seront buildables au fil des phases 2 à 4.

Voir [docs/architecture.md](docs/architecture.md).

## Phase 2 : core backend

```bash
# 1. Copier les 5 templates HTML de l'ancien projet dans
#    core/backend/src/services/email/template/  (voir le README de ce dossier)
# 2. Aligner les versions de resend / nodemailer dans core/backend/package.json
#    sur celles de l'ancien backend
# 3. Générer les migrations initiales du core ET du module (une seule fois, puis les commiter)
cp .env.example .env && ./scripts/gen-keys.sh
npm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d core-db passwords-db
./scripts/migrate-init.sh        # utilise le compte root (Prisma a besoin d'une base "shadow")
# 4. Lancer le core (migrate deploy + seed admin + serveur)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build core-backend
```

En dev, aucun vrai mail n'est envoyé : les mails passent par Ethereal (boîte factice)
et leurs liens sont affichés dans les logs (`docker compose logs -f core-backend`).

## Phase 3 : core frontend

```bash
# Dev : backend sur :3000 (docker-compose.dev.yml), frontend avec rechargement à chaud
npm install
npm run dev -w core/frontend          # http://localhost:5173 (FRONTEND_URL=http://localhost:5173 dans .env)

# Tests crypto client <-> serveur
npm test -w packages/sdk

# Stack complète via Caddy
docker compose up -d --build          # http://localhost
```

## Phase 4 : module passwords

```bash
./scripts/migrate-init.sh        # si ce n'est pas déjà fait (core + passwords)
docker compose up -d --build     # http://localhost  ->  lobby -> "Mots de passe"
```

Le module s'enregistre seul auprès du core au démarrage (il apparaît alors dans le lobby
et dans l'onglet Admin > Modules). Il faut ensuite lui donner accès :
Admin > Modules > « Accès auto » (nouveaux comptes) ou Admin > Utilisateurs (compte par compte).
Les admins ont accès à tous les modules.

## Phase 5 : tests, durcissement, déploiement

```bash
npm test                 # unitaires + interopérabilité crypto (sans Docker)
npm run test:e2e         # parcours complet sur la vraie pile (voir docs/tests.md)
./scripts/backup.sh      # sauvegarde (voir docs/deploiement.md)
```

- Tests : [docs/tests.md](docs/tests.md)
- Mise en production, sauvegardes, mises à jour, ajout d'un module : [docs/deploiement.md](docs/deploiement.md)

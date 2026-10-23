# Myprout

Plateforme modulaire auto-hébergée : un **core** (comptes, lobby, profil, admin) sur lequel se branchent des **modules** Docker.

```
myprout/
├── docker-compose.yml
├── proxy/                 # Caddy (point d'entrée unique)
├── packages/
│   ├── ui/                # thème CSS + composants Vue partagés
│   └── sdk/               # client du core, introspection, crypto partagée
├── core/{backend,frontend}
├── modules/passwords/{backend,frontend}
├── scripts/gen-keys.sh
└── docs/architecture.md
```

## Démarrage (phase 1)
```bash
cp .env.example .env        # puis éditer les mots de passe
./scripts/gen-keys.sh       # clés JWT RS256
docker compose up -d proxy core-db passwords-db
```
Les services applicatifs seront buildables au fil des phases 2 à 4.

Voir [docs/architecture.md](docs/architecture.md).

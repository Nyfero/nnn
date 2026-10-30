#!/usr/bin/env bash
# Génère les migrations Prisma initiales du core et du module passwords (à lancer une fois, puis commiter).
# Prérequis : .env rempli, `npm install`, et les bases démarrées avec les ports de dev :
#   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d core-db passwords-db
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; source .env; set +a

NAME="${1:-init}"

# URL avec identifiants encodés (mots de passe pouvant contenir des caractères spéciaux)
db_url() { # $1=mot de passe root  $2=port  $3=base
  DB_PW="$1" DB_PORT="$2" DB_NAME="$3" node -e '
    const e = encodeURIComponent, v = process.env
    process.stdout.write(`mysql://root:${e(v.DB_PW)}@127.0.0.1:${v.DB_PORT}/${v.DB_NAME}`)'
}

echo "→ core"
DATABASE_URL="$(db_url "$CORE_DB_ROOT_PASSWORD" 3307 "$CORE_DB_NAME")" \
  npx prisma migrate dev --name "$NAME" --schema core/backend/prisma/schema.prisma

echo "→ passwords"
DATABASE_URL="$(db_url "$PASSWORDS_DB_ROOT_PASSWORD" 3308 "$PASSWORDS_DB_NAME")" \
  npx prisma migrate dev --name "$NAME" --schema modules/passwords/backend/prisma/schema.prisma

echo "→ servers"
DATABASE_URL="$(db_url "$SERVERS_DB_ROOT_PASSWORD" 3309 "$SERVERS_DB_NAME")" \
  npx prisma migrate dev --name "$NAME" --schema modules/servers/backend/prisma/schema.prisma

echo "→ files"
DATABASE_URL="$(db_url "$FILES_DB_ROOT_PASSWORD" 3310 "$FILES_DB_NAME")" \
  npx prisma migrate dev --name "$NAME" --schema modules/files/backend/prisma/schema.prisma

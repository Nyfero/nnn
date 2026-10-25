#!/bin/sh
set -e
# Construit DATABASE_URL en encodant les identifiants (un mot de passe peut contenir @ : / # %...)
if [ -n "$DB_HOST" ]; then
  export DATABASE_URL=$(node -e '
const e = encodeURIComponent, v = process.env
process.stdout.write(`mysql://${e(v.DB_USER)}:${e(v.DB_PASSWORD)}@${v.DB_HOST}:3306/${v.DB_NAME}`)
')
fi

npx prisma migrate deploy
npx tsx prisma/seed.ts
exec npx tsx src/index.ts

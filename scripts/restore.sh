#!/usr/bin/env bash
# Restaure les bases depuis une sauvegarde créée par backup.sh.
# Usage : ./scripts/restore.sh backups/2026-01-31_030000
# Les bases (core-db, passwords-db) doivent tourner ; les tables existantes sont remplacées.
# Les secrets et le .env ne sont PAS écrasés : copiez-les à la main depuis la sauvegarde si besoin.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:?Usage: $0 backups/<date>}"
[ -f "$SRC/core.sql.gz" ] && [ -f "$SRC/passwords.sql.gz" ] || { echo "Sauvegarde incomplète dans $SRC" >&2; exit 1; }

echo "⚠ Les données ACTUELLES du core et des modules vont être remplacées par celles de $SRC."
read -r -p "Tapez RESTAURER pour continuer : " answer
[ "$answer" = "RESTAURER" ] || { echo "Annulé."; exit 1; }

docker compose stop core-backend passwords-backend

restore() { # $1 = service MySQL, $2 = fichier
  gzip -dc "$2" | docker compose exec -T "$1" sh -c \
    'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"'
  echo "  ✓ $1 restauré"
}
restore core-db "$SRC/core.sql.gz"
restore passwords-db "$SRC/passwords.sql.gz"

docker compose start core-backend passwords-backend
echo "Terminé. Vérifiez : docker compose ps"

#!/usr/bin/env bash
# Sauvegarde : dump SQL du core et des modules, clés JWT, .env.
# Usage : ./scripts/backup.sh [dossier-de-destination]     (défaut : ./backups)
# Rotation : BACKUP_KEEP=14 (nombre de sauvegardes conservées)
#
# ⚠ Le contenu est sensible (secrets, hachages, blobs chiffrés) : droits 700, à chiffrer avant tout envoi hors du serveur.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077

DEST_ROOT="${1:-backups}"
KEEP="${BACKUP_KEEP:-14}"
OUT="$DEST_ROOT/$(date +%Y-%m-%d_%H%M%S)"
mkdir -p "$OUT"

dump() { # $1 = service MySQL, $2 = fichier de sortie
  docker compose exec -T "$1" sh -c \
    'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --routines --no-tablespaces "$MYSQL_DATABASE"' \
    | gzip > "$2"
  gzip -t "$2"
  [ "$(gzip -dc "$2" | wc -c)" -gt 500 ] || { echo "Dump suspect (trop petit) : $2" >&2; exit 1; }
  echo "  ✓ $2"
}

echo "Sauvegarde dans $OUT"
dump core-db "$OUT/core.sql.gz"
dump passwords-db "$OUT/passwords.sql.gz"
dump servers-db "$OUT/servers.sql.gz"
# Un nouveau module = une ligne `dump <service>-db "$OUT/<service>.sql.gz"` ici

cp -r secrets "$OUT/secrets"
cp .env "$OUT/env"
echo "  ✓ secrets + .env"

# Rotation : ne garde que les $KEEP sauvegardes les plus récentes
ls -1dt "$DEST_ROOT"/*/ 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -rf

echo "Terminé. Sauvegardes présentes : $(ls -1d "$DEST_ROOT"/*/ | wc -l)"

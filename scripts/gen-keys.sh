#!/usr/bin/env sh
# Génère la paire de clés RS256 du core dans ./secrets
set -e
cd "$(dirname "$0")/.."
mkdir -p secrets
if [ -f secrets/jwt_private.pem ]; then
  echo "Clés déjà présentes, rien à faire."; exit 0
fi
openssl genpkey -algorithm RSA -out secrets/jwt_private.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -pubout -in secrets/jwt_private.pem -out secrets/jwt_public.pem
chmod 600 secrets/jwt_private.pem
echo "Clés générées dans ./secrets"

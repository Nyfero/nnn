# Architecture Myprout

## Principes
- Un **core** (identité, accès, lobby, profil, admin) et des **modules** indépendants.
- Chaque brique est un conteneur Docker. Chaque module a sa propre BDD.
- Une seule origine publique (Caddy) : `/` = core, `/<module>` = frontend du module,
  `/api/core/*` = API core, `/api/<module>/*` = API du module.
- Le core ne connaît que `user_id`. Les modules ne lisent jamais la BDD du core.

## Contrat d'un module
| Élément | Convention |
|---|---|
| Frontend | servi sur `/<id>/` (Vite `base: '/<id>/'`), conteneur nginx port 80 |
| Backend | port 3000, routes sous `/api/<id>/` |
| Services compose | `<id>-backend`, `<id>-frontend`, `<id>-db` |
| Variables | `CORE_URL`, `MODULE_ID`, `MODULE_NAME`, `MODULE_ICON`, `MODULE_PATH`, `MODULE_SECRET` |
| Enregistrement | `POST {CORE_URL}/api/core/modules/register` au démarrage (header `X-Module-Secret`) |
| Auth | `POST {CORE_URL}/api/core/introspect` avec le Bearer de l'utilisateur |
| Crypto | clé dérivée de la clé maître : `HKDF(master_key, "module:<id>")` |

## Ajouter un module
1. Créer `modules/<id>/{backend,frontend}` avec leurs Dockerfile.
2. Ajouter les services `<id>-*` dans `docker-compose.yml`.
3. Ajouter un bloc `handle /<id>*` et `handle /api/<id>/*` dans `proxy/Caddyfile`.
4. Ajouter `MODULE_SECRET_<ID>` dans `.env` et dans le service `core-backend`.

## Clé maître (zero-knowledge)
- Générée côté client à l'activation du compte.
- Stockée en base (core) sous deux blobs : chiffrée par la KEK (mot de passe) et par la KEK de récupération.
- Après login : importée dans IndexedDB en `CryptoKey` HKDF non extractable, supprimée au logout/inactivité.
- Changement de mot de passe ou reset : seul le blob du core est rechiffré.

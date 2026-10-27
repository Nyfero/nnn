# Déploiement

Guide pour une instance Myprout en production sur un serveur Linux (VPS, NAS, homelab exposé).

## 1. Prérequis
- Docker Engine + Docker Compose v2.
- Un nom de domaine dont l'enregistrement DNS `A` (et `AAAA` si IPv6) pointe vers le serveur.
- Ports **80 et 443** ouverts et libres (Caddy les utilise pour obtenir le certificat HTTPS ; un nginx/apache existant doit être arrêté ou déplacé).
- 1 Go de RAM minimum (2 Go confortable : deux MySQL).

Pare-feu minimal (ufw) :
```bash
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```
Ne publiez jamais les ports MySQL (3306), du core (3000) ni du module : **n'utilisez pas** `docker-compose.dev.yml` ni `docker-compose.e2e.yml` en production.

## 2. Configuration (`.env`)
```bash
cp .env.example .env
./scripts/gen-keys.sh                 # clés JWT RS256 dans ./secrets
```
Valeurs de production :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` (obligatoire : active les cookies `Secure` et les templates Resend) |
| `SITE_ADDRESS` | `myprout.fr` (votre domaine, sans `https://`) |
| `FRONTEND_URL` | `https://myprout.fr` (utilisé dans les liens des emails) |
| `*_DB_PASSWORD`, `*_DB_ROOT_PASSWORD` | aléatoires : `openssl rand -hex 24` |
| `MODULE_SECRET_PASSWORDS` | aléatoire : `openssl rand -hex 32` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | compte administrateur créé au premier démarrage |
| `RESEND_API_KEY` | clé API Resend |
| `LOGO_DEV_TOKEN` | optionnel (logos des sites) |
| `E2E_TOKEN` | **laisser vide** |

Dans le `.env`, doublez les `$` (`$$`) et mettez la valeur entre guillemets si elle contient `#`. Le fichier ne doit jamais être commité (déjà dans `.gitignore`).

## 3. Emails (Resend)
En production, les emails passent par des **templates Resend** (en développement : fichiers HTML locaux).

1. Créez un compte Resend et vérifiez votre domaine (enregistrements SPF et DKIM chez votre hébergeur DNS).
2. L'expéditeur est `Myprout <noreply@myprout.fr>` : si votre domaine est différent, modifiez `sender` dans `core/backend/src/services/email/utils/sendEmail.ts`.
3. Créez les 5 templates avec **exactement** ces identifiants et variables (reprenez le contenu des fichiers HTML de `core/backend/src/services/email/template/`, en remplaçant `{{variable}}` par la syntaxe Resend) :

| Identifiant | Variables |
|---|---|
| `email-validation` | `firstName`, `confirmMailRoute` |
| `new-user-registration-1` | `firstName`, `lastName`, `email`, `date`, `adminURL` |
| `account-verified` | `firstName`, `setupLinkURL` |
| `account-rejected` | `firstName` |
| `password-reset` | `firstName`, `recoveryURL` |

Publiez chaque template dans Resend avant le premier test.

## 4. Premier déploiement
Les migrations Prisma doivent être **dans le dépôt** : générez-les sur votre machine de développement avec `./scripts/migrate-init.sh` puis commitez `core/backend/prisma/migrations` et `modules/passwords/backend/prisma/migrations`. En production, le conteneur applique `prisma migrate deploy` à chaque démarrage.

```bash
git clone <votre-depot> myprout && cd myprout
cp .env.example .env && nano .env && ./scripts/gen-keys.sh
docker compose up -d --build
docker compose ps                    # tout doit être "healthy" / "running"
docker compose logs -f proxy         # certificat obtenu : "certificate obtained successfully"
```
Ouvrez `https://votre-domaine`, connectez-vous avec le compte admin, puis :
1. **Admin > Modules** : le module « Mots de passe » apparaît (il s'enregistre seul). Activez « Accès auto » pour que les nouveaux comptes y accèdent.
2. Changez le mot de passe admin dans **Profil** si celui du `.env` était provisoire (la variable `ADMIN_PASSWORD` doit rester définie : elle n'est lue que pour créer le compte la première fois).

> ⚠ **Le compte admin créé par le seed n'a pas de questions de sécurité.** S'il oublie son mot de passe, la procédure « mot de passe oublié » ne fonctionne pas, et **la clé de chiffrement de ses données est irrécupérable** (mécanisme voulu). Conservez son mot de passe dans un endroit sûr. (Évolution prévue : permettre de définir ses questions de sécurité depuis le profil.)

## 5. Mises à jour
```bash
./scripts/backup.sh                          # toujours sauvegarder avant
git pull
docker compose up -d --build                 # applique aussi les nouvelles migrations
docker compose ps && docker compose logs --tail=50 core-backend
```
Un module se met à jour seul : `docker compose up -d --build passwords-backend passwords-frontend`.
Images de base (MySQL, Caddy, nginx) : `docker compose pull && docker compose up -d`.

**Retour arrière** : `git checkout <ancienne-version>`, `docker compose up -d --build`. Si une migration a modifié les données, restaurez aussi la sauvegarde (§6).

## 6. Sauvegardes
```bash
./scripts/backup.sh                  # -> ./backups/AAAA-MM-JJ_HHMMSS/ (14 dernières conservées)
```
Contenu : dump SQL du core et du module, `secrets/` (clés JWT), `.env`.

Automatisation (crontab de l'utilisateur qui lance Docker) :
```
0 3 * * *  cd /chemin/vers/myprout && ./scripts/backup.sh >> backups/backup.log 2>&1
```

- **Copiez les sauvegardes hors du serveur** (autre machine, `rclone`, `restic`…) et **chiffrez-les** avant : elles contiennent vos secrets (`.env`, clé privée JWT) et les données des utilisateurs.
- Les données des modules sont chiffrées avec les mots de passe des utilisateurs : une sauvegarde volée ne permet pas de les lire sans ces mots de passe (ni les réponses de sécurité), mais elle contient des hachages attaquables hors ligne si un mot de passe est faible.
- **Testez la restauration** au moins une fois (sur une machine de test) :
  ```bash
  ./scripts/restore.sh backups/2026-01-31_030000
  ```
- Perdre `secrets/` n'est pas catastrophique : régénérez-les avec `gen-keys.sh`, tous les utilisateurs devront simplement se reconnecter. Perdre la base, en revanche, est définitif sans sauvegarde.

## 7. Sécurité : liste de contrôle
- [ ] `NODE_ENV=production`, `SITE_ADDRESS` = domaine, HTTPS actif (cadenas), `E2E_TOKEN` vide.
- [ ] Aucun fichier `docker-compose.dev.yml` / `.e2e.yml` utilisé ; seuls 80 et 443 sont publics (`ss -ltnp`).
- [ ] Secrets longs et uniques ; `.env` et `secrets/` en droits `600`, hors du dépôt Git.
- [ ] Sauvegardes chiffrées et copiées hors du serveur, restauration testée.
- [ ] Système et images mis à jour régulièrement.
- [ ] Rotation des logs Docker (voir §8).

Ce que le serveur peut voir : adresses email, noms, hachages bcrypt des mots de passe et des réponses de sécurité, blobs de clé chiffrés, données des modules **chiffrées**. Ce qu'il ne stocke jamais : les mots de passe en clair, la clé maître, les secrets enregistrés dans le module passwords.
Limite à connaître : le mot de passe de connexion transite en clair (chiffré par HTTPS) jusqu'au serveur pour être haché. Un serveur compromis *activement* pourrait l'intercepter à la connexion suivante ; la clé maître n'est donc pas protégée contre un attaquant qui contrôlerait le code du serveur.

**Content-Security-Policy (optionnel)** : non activée par défaut car elle doit être validée sur votre instance. Pour l'essayer, ajoutez dans le bloc `header` du `Caddyfile`, d'abord en mode observation :
```
Content-Security-Policy-Report-Only "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'"
```
Surveillez la console du navigateur, puis remplacez par `Content-Security-Policy` si aucune violation n'apparaît.

## 8. Exploitation
```bash
docker compose ps                         # état et santé (healthchecks des backends)
docker compose logs -f core-backend       # ou passwords-backend, proxy
docker compose restart core-backend
docker stats --no-stream
```
Rotation des logs (sinon ils grossissent sans limite) — `/etc/docker/daemon.json` puis `sudo systemctl restart docker` :
```json
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
```
Tous les services ont `restart: unless-stopped` : ils redémarrent avec le serveur.

## 9. Ajouter un module
Un module est une application indépendante qui respecte le contrat décrit dans [architecture.md](architecture.md). Prenez `modules/passwords/` comme modèle (identifiant `notes` dans l'exemple) :

1. **Code** : `modules/notes/{backend,frontend}` avec leurs `Dockerfile`.
   - Backend : `coreAuth(...)` sur ses routes, `registerModule(...)` au démarrage, route interne `DELETE /api/notes/internal/users/:user_id` (purge des données, protégée par `requireModuleSecret`).
   - Frontend : Vite avec `base: '/notes/'` ; reprenez le démarrage de `modules/passwords/frontend/src/main.js` (session via le core, redirection `/login` ou `/unlock`, clé via `getModuleKey('notes', userId)`), et `AppShell` de `@myprout/ui` pour la navbar et le fond.
2. **Compose** : ajoutez `notes-db`, `notes-backend`, `notes-frontend` (copiez les trois blocs `passwords-*`), ainsi que `MODULE_SECRET_NOTES` dans l'environnement de `core-backend`.
3. **Proxy** : dans `proxy/Caddyfile`, un bloc `@notes path /notes /notes/*` + `handle` vers `notes-frontend:80`, et `handle /api/notes/*` vers `notes-backend:3000`. (Les routes `/api/*/internal/*` sont déjà bloquées pour tous les modules.)
4. **Secret** : `MODULE_SECRET_NOTES=$(openssl rand -hex 32)` dans `.env`.
5. **Migrations** : `prisma migrate dev` pour la base du module, à commiter.
6. **Sauvegarde** : ajoutez la ligne `dump notes-db …` dans `scripts/backup.sh` et la restauration dans `restore.sh`.
7. **Mise en service** : `docker compose up -d --build`. Le module apparaît dans **Admin > Modules** ; donnez-lui l'accès aux utilisateurs.

Le chiffrement reste propre à chaque module : `getModuleKey('notes', userId)` fournit une clé AES-GCM dérivée de la clé maître et distincte de celle des autres modules.

### Évolution possible : enregistrement par labels Docker
Aujourd'hui, un module s'annonce lui-même (`registerModule`). Avec des labels (`myprout.module.id`, `myprout.module.name`, `myprout.module.path`…), le core pourrait lire les conteneurs en cours d'exécution. Cela suppose l'accès à l'API Docker : **ne montez jamais `/var/run/docker.sock` directement dans le core** (équivalent à un accès root) ; passez par un proxy en lecture seule (par exemple `tecnativa/docker-socket-proxy` avec `CONTAINERS=1`). Le registre `modules` du core et la page d'administration n'auraient pas à changer.

## 10. Dépannage
| Symptôme | Cause et solution |
|---|---|
| `bind: address already in use` (port 80) | un autre serveur web tourne : l'arrêter, ou changer les ports publiés du proxy |
| `P1013 … invalid port number in database URL` | ancien entrypoint : le mot de passe contient un caractère spécial et l'URL n'est pas encodée ; reprenez `docker-entrypoint.sh` à jour et `up -d --build` |
| `Environment variable not found: DATABASE_URL` | entrypoint et `docker-compose.yml` de versions différentes (le compose fournit `DB_HOST`, `DB_NAME`…) |
| `http proxy error` (Vite) | le backend du core ne tourne pas (`docker compose ps`, `logs core-backend`) |
| Le conteneur redémarre en boucle, « no migration found » | dossiers `prisma/migrations` absents du dépôt |
| `Access denied for user` | mot de passe MySQL modifié après la création du volume ; recréer le volume (données perdues) ou revenir à l'ancien mot de passe |
| Le module n'apparaît pas | `docker compose logs passwords-backend` : « enregistrement impossible (HTTP 401) » = secrets différents |
| Connexion qui ne « tient » pas | `NODE_ENV=production` sans HTTPS : le cookie `Secure` est refusé |
| Pas de certificat HTTPS | DNS non propagé, ports 80/443 non joignables depuis Internet ; `docker compose logs proxy` |

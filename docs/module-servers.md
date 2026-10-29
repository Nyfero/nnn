# Module servers (serveurs de jeu)

Allume, éteint, redémarre et affiche l'état de conteneurs Docker de la même machine. L'admin déclare chaque serveur (nom + nom du conteneur) et choisit quels utilisateurs peuvent le piloter. Les admins voient tout.

## Sécurité : pas de socket Docker dans le module
`servers-backend` ne touche jamais `/var/run/docker.sock`. Il passe par `docker-proxy` (HAProxy, `modules/servers/docker-proxy.cfg`) qui ne laisse passer que :
- `GET /containers/<nom>/json`
- `POST /containers/<nom>/(start|stop|restart)`

Tout le reste (création de conteneur, exec, volumes...) renvoie 403. Même un backend compromis ne peut donc pas obtenir un accès root à l'hôte via l'API Docker.
Garde-fou supplémentaire : les conteneurs du projet compose `myprout` sont refusés (variable `PROTECTED_PROJECT`).

## Intégration dans le dépôt

### 1. `.env.example` (et `.env`)
```
MODULE_SECRET_SERVERS=change-me-long-random
SERVERS_DB_NAME=myprout_servers
SERVERS_DB_USER=myprout_srv
SERVERS_DB_PASSWORD=change-me
SERVERS_DB_ROOT_PASSWORD=change-me-root
```
Générer le secret : `openssl rand -hex 32`.

### 2. `docker-compose.yml`
Dans `core-backend` > `environment`, ajouter :
```yaml
      MODULE_SECRET_SERVERS: ${MODULE_SECRET_SERVERS}
```
Ajouter les services (avant `networks:`) :
```yaml
  # ───────────── Module : servers ─────────────
  docker-proxy:
    image: haproxy:3.0-alpine
    restart: unless-stopped
    user: root # nécessaire pour lire le socket Docker
    volumes:
      - ./modules/servers/docker-proxy.cfg:/usr/local/etc/haproxy/haproxy.cfg:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks: [servers-docker]

  servers-db:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${SERVERS_DB_NAME}
      MYSQL_USER: ${SERVERS_DB_USER}
      MYSQL_PASSWORD: ${SERVERS_DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${SERVERS_DB_ROOT_PASSWORD}
    volumes:
      - servers_db_data:/var/lib/mysql
    healthcheck:
      <<: *mysql-healthcheck
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-p${SERVERS_DB_ROOT_PASSWORD}']
    networks: [servers-internal]

  servers-backend:
    build:
      context: .
      dockerfile: modules/servers/backend/Dockerfile
    restart: unless-stopped
    depends_on:
      servers-db:
        condition: service_healthy
      core-backend:
        condition: service_started
      docker-proxy:
        condition: service_started
    environment:
      NODE_ENV: ${NODE_ENV}
      PORT: 3000
      DB_HOST: servers-db
      DB_NAME: ${SERVERS_DB_NAME}
      DB_USER: ${SERVERS_DB_USER}
      DB_PASSWORD: ${SERVERS_DB_PASSWORD}
      CORE_URL: http://core-backend:3000
      MODULE_ID: servers
      MODULE_NAME: Serveurs de jeu
      MODULE_ICON: sports_esports
      MODULE_PATH: /servers
      MODULE_INTERNAL_URL: http://servers-backend:3000
      MODULE_SECRET: ${MODULE_SECRET_SERVERS}
      DOCKER_API_URL: http://docker-proxy:2375
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "fetch('http://127.0.0.1:3000/api/servers/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 40s
    networks: [edge, core-internal, servers-internal, servers-docker]

  servers-frontend:
    build:
      context: .
      dockerfile: modules/servers/frontend/Dockerfile
    restart: unless-stopped
    networks: [edge]
```
Dans `networks:` et `volumes:` :
```yaml
  servers-internal:
  servers-docker:
```
```yaml
  servers_db_data:
```

### 3. `proxy/Caddyfile`
Dans la section APIs :
```
	handle /api/servers/* {
		reverse_proxy servers-backend:3000
	}
```
Dans la section frontends des modules :
```
	@servers path /servers /servers/*
	handle @servers {
		reverse_proxy servers-frontend:80
	}
```
(Les routes `/api/*/internal/*` sont déjà bloquées pour tous les modules.)

### 4. Scripts
- `docker-compose.dev.yml` : `servers-db: ports: ['127.0.0.1:3309:3306']` et `servers-backend: ports: ['127.0.0.1:3002:3000']`.
- `scripts/migrate-init.sh` : ajouter à la fin
  ```bash
  echo "→ servers"
  DATABASE_URL="$(db_url "$SERVERS_DB_ROOT_PASSWORD" 3309 "$SERVERS_DB_NAME")" \
    npx prisma migrate dev --name "$NAME" --schema modules/servers/backend/prisma/schema.prisma
  ```
  (La migration initiale est déjà fournie : cette étape n'est utile que pour les évolutions futures.)
- `scripts/backup.sh` : `dump servers-db "$OUT/servers.sql.gz"` sous la ligne de passwords.
- `scripts/restore.sh` : ajouter `servers.sql.gz` au test de présence, `servers-backend` aux `stop`/`start`, et `restore servers-db "$SRC/servers.sql.gz"`.

### 5. Mise en service
```bash
npm install                      # met à jour package-lock.json (nouveaux workspaces)
docker compose up -d --build
```
Puis : **Admin > Modules** (le module apparaît seul) > « Accès auto » ou accès par utilisateur dans **Admin > Utilisateurs**. Ensuite, onglet **Gestion** du module : ajouter un serveur et cocher ses utilisateurs.

## Côté serveurs de jeu
- Donne un nom fixe au conteneur (`container_name: minecraft` dans son compose), c'est ce nom qu'on saisit.
- Avec `restart: unless-stopped`, un serveur éteint depuis l'interface reste éteint, même après un redémarrage de la machine. Avec `always`, il repartirait au redémarrage du démon Docker.
- Un serveur avec `healthcheck` affiche « Démarrage… » tant qu'il n'est pas prêt, puis « En ligne ».
- Arrêt : 20 s sont laissées au jeu pour sauvegarder avant l'arrêt forcé.

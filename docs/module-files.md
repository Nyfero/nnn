# Module Fichiers (NAS)

Gestion de fichiers pour Myprout : dossiers, envoi/téléchargement, aperçu des images/vidéos/audio, recherche, glisser-déposer,
**corbeille** (purge automatique à 7 jours), **coffres chiffrés** (noms et contenus), **quotas par utilisateur**,
et un **stockage conçu pour changer de disque** sans toucher aux données.

## 1. Choix de conception

| Sujet       | Choix                                                                                        | Pourquoi                                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chiffrement | **Par coffre** : l'utilisateur crée des dossiers racines « coffres » ; le reste est en clair | Le chiffrement côté navigateur coûte des fonctions (recherche, aperçu instantané, gros fichiers). On ne les sacrifie que pour les documents sensibles |
| Stockage    | Blobs anonymes (`u<id>/ab/<uuid>`) sur un « backend » ; noms et dossiers **en base**         | Changer de disque = déplacer des blobs, l'arborescence ne bouge pas                                                                                   |
| Quotas      | Quota par défaut + personnalisé ou illimité par utilisateur, réservé **avant** l'écriture    | Pas de dépassement même avec des envois simultanés                                                                                                    |
| Suppression | **Corbeille** 7 jours, puis effacement définitif                                             | Rattrapage d'erreurs ; la corbeille compte dans le quota (sinon on contournerait son quota)                                                           |
| Envois      | Corps brut streamé directement sur disque                                                    | Pas de limite mémoire côté serveur                                                                                                                    |

## 2. Contenu de l'archive

```
modules/files/backend/    API Express + Prisma (MySQL), stockage, quotas, corbeille, tests
modules/files/frontend/   Vue 3 (même thème et conventions que le module passwords), crypto des coffres, tests
docs/module-files.md      ce document
```

Décompressez **à la racine du dépôt** : `tar xzf myprout-module-files.tar.gz`.

## 3. Installation

### 3.1 `.env` (et `.env.example`)

```bash
MODULE_SECRET_FILES=$(openssl rand -hex 32)       # à coller en clair dans .env

FILES_DB_NAME=myprout_files
FILES_DB_USER=myprout_files
FILES_DB_PASSWORD=change-me
FILES_DB_ROOT_PASSWORD=change-me-root

FILES_DATA_DIR=./data/files      # où sont stockés les fichiers (voir §7)
FILES_DEFAULT_QUOTA=1GB          # quota par utilisateur (5 utilisateurs = 5 Go à réserver)
FILES_TRASH_DAYS=7               # durée de conservation dans la corbeille
FILES_MIN_FREE=1GB               # espace disque toujours laissé libre (voir §5)
FILES_MAX_UPLOAD=                # taille max par fichier (vide = aucune)
```

Ajoutez `data/` à `.gitignore` **et à `.dockerignore`** (sinon Docker envoie vos fichiers dans le contexte de build).

### 3.2 `docker-compose.yml`

Dans `core-backend` > `environment` :

```yaml
MODULE_SECRET_FILES: ${MODULE_SECRET_FILES}
```

Nouveaux services (à côté de `passwords-*`) :

```yaml
  files-db:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_DATABASE: ${FILES_DB_NAME}
      MYSQL_USER: ${FILES_DB_USER}
      MYSQL_PASSWORD: ${FILES_DB_PASSWORD}
      MYSQL_ROOT_PASSWORD: ${FILES_DB_ROOT_PASSWORD}
    volumes:
      - files_db_data:/var/lib/mysql
    healthcheck:
      <<: *mysql-healthcheck
      test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost', '-p${FILES_DB_ROOT_PASSWORD}']
    networks: [files-internal]

  files-backend:
    build:
      context: .
      dockerfile: modules/files/backend/Dockerfile
    restart: unless-stopped
    depends_on:
      files-db:
        condition: service_healthy
      core-backend:
        condition: service_started
    environment:
      NODE_ENV: ${NODE_ENV}
      PORT: 3000
      DB_HOST: files-db
      DB_NAME: ${FILES_DB_NAME}
      DB_USER: ${FILES_DB_USER}
      DB_PASSWORD: ${FILES_DB_PASSWORD}
      CORE_URL: http://core-backend:3000
      MODULE_ID: files
      MODULE_NAME: Fichiers
      MODULE_ICON: folder
      MODULE_PATH: /files
      MODULE_INTERNAL_URL: http://files-backend:3000
      MODULE_SECRET: ${MODULE_SECRET_FILES}
      FILES_STORAGE_PATH: /data/files
      FILES_DEFAULT_QUOTA: ${FILES_DEFAULT_QUOTA:-1GB}
      FILES_TRASH_DAYS: ${FILES_TRASH_DAYS:-7}
      FILES_MIN_FREE: ${FILES_MIN_FREE:-1GB}
      FILES_MAX_UPLOAD: ${FILES_MAX_UPLOAD:-}
    volumes:
      - ${FILES_DATA_DIR:-./data/files}:/data/files
    healthcheck:
      test: ['CMD', 'node', '-e', "fetch('http://127.0.0.1:3000/api/files/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 40s
    networks: [edge, core-internal, files-internal]

  files-frontend:
    build:
      context: .
      dockerfile: modules/files/frontend/Dockerfile
    restart: unless-stopped
    networks: [edge]
```

Puis `files-internal:` dans `networks:` et `files_db_data:` dans `volumes:`.

### 3.3 `proxy/Caddyfile`

```
	handle /api/files/* {
		reverse_proxy files-backend:3000 {
			flush_interval -1
		}
	}

	@files path /files /files/*
	handle @files {
		reverse_proxy files-frontend:80
	}
```

Les routes `/api/files/internal/*` sont déjà bloquées par la règle générique existante. Caddy n'impose aucune limite de taille d'envoi.
Si vous passez par un tunnel/CDN (Cloudflare…), vérifiez **sa** limite de taille de requête (100 Mo en offre gratuite).

### 3.4 Développement, sauvegardes, tests

- `docker-compose.dev.yml` : `files-db: ports: ['127.0.0.1:3310:3306']` et `files-backend: ports: ['127.0.0.1:3003:3000']`.
- `scripts/backup.sh` : `dump files-db "$OUT/files.sql.gz"` ; `scripts/restore.sh` : exiger et restaurer `files.sql.gz`, et ajouter `files-backend` aux `stop`/`start`.
- **Les migrations sont déjà fournies** (`20261029000000_init`, `20261030000000_trash_and_vaults`) : `prisma migrate deploy` les applique au démarrage. Si vous les régénérez avec `scripts/migrate-init.sh`, ajoutez-y un bloc `files` (port `3310`).
- Racine `package.json` : `"test": "npm test -w packages/sdk -w core/backend -w modules/files/backend -w modules/files/frontend"` et ajouter `-w modules/files/frontend` au script `build`.

### 3.5 Démarrage

```bash
npm install                      # met à jour le workspace et package-lock.json
docker compose up -d --build files-db files-backend files-frontend core-backend proxy
docker compose logs -f files-backend   # "[files] stockage "local" -> /data/files", puis "enregistré auprès du core"
```

Dans l'interface : **Admin > Modules** → le module « Fichiers » apparaît ; activez « Accès auto » pour les nouveaux comptes, ou donnez l'accès par utilisateur (**Admin > Utilisateurs**). Les admins y ont accès d'office.
Les quotas se règlent dans le module, onglet **Espace et quotas** (admins).

## 4. Configuration

| Variable                | Défaut        | Rôle                                                                                                                        |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `FILES_STORAGE_PATH`    | `/data/files` | Dossier du backend `local` (dans le conteneur)                                                                              |
| `FILES_EXTRA_BACKENDS`  | vide          | Autres disques : `archive=/mnt/archive,disk2=/mnt/disk2`                                                                    |
| `FILES_DEFAULT_BACKEND` | `local`       | Backend qui reçoit les **nouveaux** fichiers                                                                                |
| `FILES_DEFAULT_QUOTA`   | `1GB`         | Quota initial par utilisateur ; `unlimited` possible. Une fois modifié dans l'interface, **la valeur de l'interface prime** |
| `FILES_TRASH_DAYS`      | `7`           | Jours avant effacement définitif de la corbeille                                                                            |
| `FILES_MIN_FREE`        | `1GB`         | Les envois sont refusés si le disque passerait sous cette réserve                                                           |
| `FILES_MAX_UPLOAD`      | aucune        | Taille maximale d'un fichier                                                                                                |

Tailles : `500MB`, `5GB`, `1.5TB` (base 1024).

## 5. Quotas

- Chaque utilisateur : **par défaut (1 Go)**, **personnalisé** (Mo/Go/To) ou **illimité**. L'admin a le même quota que les autres pour l'instant (modifiable dans la page admin).
- À chaque envoi, la taille annoncée est **réservée** dans une transaction verrouillée par utilisateur ; si `utilisé + taille > quota`, l'envoi est refusé (HTTP 507, `QUOTA_EXCEEDED`) avant d'écrire un octet.
- L'utilisé = somme des tailles des fichiers **y compris ceux de la corbeille**. Dans un coffre, la taille comptée est celle du fichier chiffré (+28 octets par Mio).
- Les envois interrompus sont nettoyés au démarrage et toutes les 15 min (au-delà de 12 h).
- Réduire un quota sous l'usage actuel ne supprime rien : l'utilisateur ne peut plus envoyer tant qu'il n'a pas libéré de place.
- **Sur-allocation** : la page admin compare la somme des quotas à la capacité du disque et avertit si elle la dépasse.
- **Pour vos tests (5 × 1 Go)** : prévoyez 5 Go + `FILES_MIN_FREE`. Si le disque est petit, baissez `FILES_MIN_FREE` (ex. `200MB`) : c'est elle, et non les quotas, qui produit un refus `DISK_FULL`.
- Suppression d'un compte : le core prévient le module, qui supprime fichiers, corbeille et blobs.

## 6. Coffres chiffrés et corbeille

### 6.1 Coffres

Un **coffre** se crée à la racine (bouton « Coffre »). Tout ce qu'il contient (sous-dossiers, fichiers, **et leurs noms**) est chiffré dans le navigateur avant l'envoi ; le serveur ne stocke que des blobs et des noms illisibles.

- **Clés** : chaque coffre a un secret aléatoire de 32 octets, chiffré par la clé du module `HKDF(clé maître, "module:files")` (la même chaîne que pour le module Mots de passe) et stocké sur le serveur. De ce secret dérivent une clé AES-GCM (noms + contenus) et une clé HMAC (unicité des noms). Le serveur ne connaît jamais ces clés.
- **Contenu** : blocs de 1 Mio chiffrés en AES-GCM (IV aléatoire), chaque bloc authentifie son rang et s'il est le dernier. Une modification, un bloc déplacé ou un fichier tronqué est détecté au déchiffrement.
- **Noms** : chiffrés ; le serveur reçoit aussi un index HMAC pour refuser deux noms identiques dans un dossier, sans connaître le nom.
- **Ce que le serveur voit malgré tout** : l'arborescence (qui contient quoi), le nombre et la **taille** des fichiers, les dates, et l'existence des coffres.
- **Changement de mot de passe** : sans effet sur les coffres (la clé maître ne change pas). **Mot de passe oublié** : les coffres restent lisibles grâce aux questions de sécurité, qui retrouvent la clé maître. **Mot de passe ET réponses perdus : contenu définitivement perdu.** Le compte admin créé par le seed n'a pas de questions de sécurité (voir `deploiement.md`).

Ce qui change dans un coffre (le prix de la sécurité) :
| Fonction | Dans un coffre |
|---|---|
| Recherche | filtre local du dossier ouvert (pas de recherche serveur globale) ; les coffres sont exclus de la recherche normale |
| Aperçu image/vidéo/audio | possible, mais le fichier est **d'abord déchiffré en entier** (pas de lecture en flux ni d'avance rapide immédiate) |
| Taille maximale | **300 Mo** par fichier (envoi et téléchargement se font en mémoire du navigateur) |
| Déplacement | uniquement **à l'intérieur du même coffre**. Entre coffre et extérieur (ou deux coffres) : télécharger puis renvoyer |
| Doublon de nom | refusé (409) ; l'envoi renomme automatiquement `fichier (1).ext` côté navigateur |

### 6.2 Corbeille

- « Supprimer » envoie à la corbeille (dossier et contenu compris), après confirmation. **Restaurer** remet à l'emplacement d'origine.
- Dossier d'origine absent ou lui-même à la corbeille : restauration **à la racine** (zone normale). Dans un coffre, il faut restaurer d'abord le dossier parent.
- Nom déjà pris à l'emplacement d'origine : renommé `fichier (1).ext`, ou, dans un coffre, le navigateur demande un nouveau nom.
- Purge automatique après `FILES_TRASH_DAYS` jours (contrôle toutes les heures), « Supprimer définitivement » et « Vider » disponibles. Suppression des fichiers du disque incluse.
- La corbeille compte dans le quota.

## 7. Stockage évolutif (disque dédié)

Aujourd'hui : un simple dossier (`FILES_DATA_DIR`). Tout fonctionne donc dès maintenant sur le disque du serveur.

**Cas A : le disque dédié arrive, on veut tout y mettre**

1. Montez le disque (ex. `/mnt/nas`, idéalement via `/etc/fstab`).
2. Arrêtez le module : `docker compose stop files-backend`.
3. Copiez : `rsync -aH ./data/files/ /mnt/nas/files/`.
4. `FILES_DATA_DIR=/mnt/nas/files` dans `.env`, puis `docker compose up -d files-backend`.
   Rien d'autre à changer : la base ne référence que des noms de backend, pas des chemins. Les blobs de coffres se déplacent comme les autres (ils sont opaques).

**Cas B : on garde l'ancien et on ajoute le nouveau (sans interruption)**

1. Ajoutez le volume dans `files-backend` : `- /mnt/nas/files:/data/nas` et `FILES_EXTRA_BACKENDS: nas=/data/nas`.
2. `FILES_DEFAULT_BACKEND: nas` : les **nouveaux** fichiers y vont, les anciens restent lisibles sur `local`.
3. Pour tout migrer (optionnel, relançable à volonté, service actif) :
   ```bash
   docker compose exec files-backend npm run move-backend -- local nas --dry-run
   docker compose exec files-backend npm run move-backend -- local nas
   ```
   Chaque fichier est copié, sa taille vérifiée, la base basculée, puis l'ancien blob supprimé.

**Autres types de stockage (S3, SMB…)** : implémenter l'interface `StorageBackend` (`src/storage/types.ts`, 5 méthodes) et l'enregistrer dans `src/storage/index.ts`. Un montage NFS/SMB sur l'hôte fonctionne déjà tel quel comme dossier.

Disque non monté au démarrage : le module refuse de démarrer avec un message clair (au lieu d'écrire sur le mauvais disque).

## 8. Sauvegarde

`scripts/backup.sh` ne sauvegarde que la **base** (noms, arborescence, quotas, **clés de coffres chiffrées**). **Les fichiers eux-mêmes ne sont pas inclus** : sauvegardez le dossier de données avec `rsync`/`restic`/`rclone`, à un moment proche du dump SQL (un blob sans ligne est un orphelin inoffensif ; une ligne sans blob donne une erreur 404 au téléchargement).

```
0 3 * * *  cd /chemin/myprout && ./scripts/backup.sh && restic -r /mnt/backup backup ./data/files
```

Une sauvegarde volée ne permet pas de lire les coffres sans le mot de passe de l'utilisateur ; les fichiers hors coffre y sont lisibles en clair (chiffrez la sauvegarde).

## 9. Sécurité

- Toute requête passe par `coreAuth` (token validé par le core, accès au module vérifié). Chaque requête SQL est filtrée par `user_id` : aucun accès aux fichiers d'autrui (même pour un admin, qui ne gère que les quotas).
- Téléchargement/aperçu : lien signé (HMAC avec `MODULE_SECRET`), 10 min (téléchargement) ou 1 h (aperçu média), lié au fichier et à l'utilisateur. Un fichier de coffre est de toute façon illisible sans sa clé.
- Hors coffre : seuls images, vidéos, audio et texte brut s'affichent dans le navigateur ; HTML, SVG, PDF… sont **forcés en téléchargement** (anti-XSS sur la même origine), avec `nosniff` et CSP `sandbox`.
- Noms validés (pas de `/`, `\`, `..`), chemins disque aléatoires (aucun nom utilisateur sur le disque).
- Hors coffre, le serveur voit les fichiers en clair : chiffrez le disque (LUKS) si nécessaire.
- Limite du chiffrement : un serveur malveillant pourrait échanger deux fichiers d'un même coffre (les blocs sont authentifiés, pas l'association nom/contenu). Il ne peut ni les lire, ni les modifier sans que cela soit détecté.

## 10. API (`/api/files`, Bearer du core)

| Route                                                                         | Rôle                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /me`                                                                     | quota, utilisé, libre, part de la corbeille                                                                                     |
| `GET /nodes?parent_id=`                                                       | contenu d'un dossier + fil d'Ariane (racine si absent)                                                                          |
| `GET /search?q=`                                                              | recherche par nom (zones non chiffrées)                                                                                         |
| `GET /vaults`, `POST /vaults`                                                 | clés chiffrées des coffres ; création `{name, name_key, wrapped_key}`                                                           |
| `POST /folders`                                                               | `{name, parent_id?}` (+ `name_key` dans un coffre)                                                                              |
| `POST /upload?name=&parent_id=`                                               | corps brut, `Content-Length` obligatoire ; doublon hors coffre → `fichier (1).ext` ; dans un coffre `name` chiffré + `name_key` |
| `PATCH /nodes/:id`                                                            | renommer / déplacer (`parent_id: null` = racine)                                                                                |
| `DELETE /nodes/:id`                                                           | **envoi à la corbeille**                                                                                                        |
| `GET /trash`, `POST /trash/:id/restore`, `DELETE /trash/:id`, `DELETE /trash` | lister, restaurer, supprimer définitivement, vider                                                                              |
| `POST /nodes/:id/link`                                                        | lien signé `/api/files/dl/<token>` (plages d'octets supportées)                                                                 |
| `GET /admin/overview`, `PUT /admin/accounts/:user_id`, `PUT /admin/settings`  | admin : stockage, quotas                                                                                                        |

Codes : `507 QUOTA_EXCEEDED` / `DISK_FULL`, `409 NAME_EXISTS` / `PARENT_TRASHED`, `413 FILE_TOO_LARGE`.

## 11. Points mis de côté (à reprendre plus tard)

- **Déconnexion à 20 min d'inactivité** (règle du core, `createInactivityGuard`) : un très long envoi sans aucune activité souris/clavier peut être interrompu. Pistes : faire « battre » l'inactivité pendant un envoi/téléchargement, ou allonger le délai pour ce module. À traiter si l'usage réel le montre.
- **Partage entre utilisateurs** : repoussé, en attente de la refonte des droits du core (rôles et presets) et d'un annuaire d'utilisateurs (module de messagerie envisagé). Ce qui est déjà prêt : chaque coffre a sa propre clé, qu'il suffira de rechiffrer pour un autre utilisateur (paire de clés par utilisateur, empreintes à comparer). Pour les dossiers hors coffre, une table de partages `(node, user, droit)` suffira. Retirer un destinataire d'un coffre exigera de rechiffrer le coffre.
- **Liens de téléchargement pour des personnes extérieures** : repoussé ; pour l'instant, on invite la personne à créer un compte. Si on le fait : jeton aléatoire stocké haché, expiration, mot de passe optionnel, compteur de téléchargements, révocation, limitation de débit ; pour un fichier de coffre, la clé voyage dans la partie `#` de l'URL (jamais envoyée au serveur) et le navigateur déchiffre.
- Autres limites : pas de téléchargement de dossier en ZIP, pas de reprise d'un envoi interrompu, pas d'envoi de dossiers par glisser-déposer (fichiers seulement), pas de versions/écrasement, fichiers de coffre limités à 300 Mo (un envoi par morceaux lèverait la limite), instance unique du backend (verrous et nettoyages supposent un seul `files-backend`).

## 12. Vérifications à faire après installation

Le module a été écrit sans pouvoir démarrer la stack : la crypto des coffres est testée (Node), les noms/liens signés aussi, les composants Vue compilent, mais **le backend n'a pas été exécuté contre une vraie base** et l'interface n'a pas été essayée dans un navigateur.

1. `npm test -w modules/files/backend` (6 tests), `npm test -w modules/files/frontend` (5 tests de crypto), `npm run typecheck -w modules/files/backend`.
2. `docker compose up -d --build`, `docker compose logs files-backend` : 2 migrations appliquées, stockage initialisé, module enregistré.
3. Hors coffre : envoyer, télécharger, lire une vidéo (avance rapide), dépasser le quota, déplacer un dossier dans lui-même (refusé), mettre un dossier non vide à la corbeille et le restaurer.
4. Coffre : créer, y envoyer un fichier, le rouvrir, vérifier dans la base que `name` est illisible et que le fichier sur disque n'est pas lisible (`file data/files/u*/*/*`) ; essayer de déplacer un fichier hors du coffre (refusé).
5. Corbeille : pour tester la purge sans attendre, mettre `FILES_TRASH_DAYS=1` puis `UPDATE nodes SET trashed_at = NOW() - INTERVAL 2 DAY WHERE trash_root = 1;` et redémarrer le module.
6. Supprimer un compte de test : `docker compose exec files-backend ls /data/files` ne doit plus contenir son dossier `u<id>`.

## 13. Dépannage

| Symptôme                                                             | Cause                                                                                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Le module démarre puis s'arrête : « stockage … »                     | dossier absent / non accessible en écriture / disque non monté                                             |
| « enregistrement impossible (HTTP 401) »                             | `MODULE_SECRET_FILES` absent de `core-backend` ou différent                                                |
| Le module n'apparaît pas dans le lobby                               | accès non accordé (Admin > Modules / Utilisateurs)                                                         |
| Redirection vers « Déverrouiller votre coffre » en ouvrant le module | clé maître absente de ce navigateur : saisir le mot de passe (comme pour Mots de passe)                    |
| Un coffre affiche « (illisible) »                                    | clé du coffre non déchiffrable (clé maître différente après une réinitialisation sans les bonnes réponses) |
| Envoi qui échoue à 100 Mo derrière un tunnel                         | limite du tunnel/CDN, pas du module                                                                        |
| 507 `DISK_FULL` alors que le quota est large                         | moins de `FILES_MIN_FREE` libre sur le disque                                                              |
| Téléchargement 404                                                   | blob absent du disque (restauration partielle)                                                             |

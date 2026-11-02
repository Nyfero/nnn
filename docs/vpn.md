# Module VPN

VPN WireGuard pour la famille. Le trafic des appareils passe par le serveur Myprout puis ressort sur
Internet avec **l'adresse IP du serveur**.

> Pour que les sites vous voient « en France », le serveur doit être hébergé en France (VPS français, ou box
> à domicile). Le module ne change pas l'emplacement du serveur : il fait transiter le trafic par lui.

## Qui peut l'utiliser

Deux filtres se cumulent :

1. **Le core** (rôles existants) décide qui voit le module : `FAMILLE` (rôle « tous les modules sauf… ») le reçoit
   d'office, les admins aussi. `AMIS` l'avait aussi par défaut (« tous les modules ») : `ROLE_DEFAULTS` l'exclut
   désormais, mais **ces valeurs ne s'appliquent qu'à l'initialisation d'un rôle**. Sur une base existante,
   excluez le VPN du rôle AMIS dans **Administration > Rôles**, ou en SQL :
   ```sql
   INSERT IGNORE INTO roleModules (role_id, module_id) SELECT role_id, 'vpn' FROM roles WHERE role = 'AMIS';
   ```
2. **Le module** refuse toute requête d'un utilisateur qui n'est ni admin ni membre d'un rôle de
   `VPN_ALLOWED_ROLES` (défaut `FAMILLE`), même si le core lui a donné accès au module (exception individuelle
   `userModules`, rôle « tous les modules »…). C'est la règle qui garantit « famille uniquement ».

**Retrait de droits.** Toutes les minutes, `vpn-backend` demande au core la liste des utilisateurs qui sont admin
ou détiennent un rôle autorisé *et* ont accès au module (`GET /api/core/modules/access?roles=FAMILLE`). Les
appareils des autres sont **suspendus** (retirés de WireGuard, réactivés si le rôle revient). Si le core est
injoignable, rien ne change. La suppression d'un compte supprime ses appareils (`/internal/users/:id`, déjà appelé par le core).

## Architecture

```
navigateur ──(clé publique)──▶ vpn-backend ──peers.conf──▶ ┐ volume
                                  ▲   ◀─server.pub/status─ ┘ vpn_shared
                       coreAuth + │                          │
                    réconciliation│                   vpn-wireguard  ◀── UDP 51820 ── appareils
                          core-backend                   (wg0 + NAT)  ──▶ Internet
```

| Service         | Rôle                                                                       | Réseaux                           | Privilèges  |
| --------------- | -------------------------------------------------------------------------- | --------------------------------- | ----------- |
| `vpn-backend`   | API : appareils, attribution d'IP, écriture de `peers.conf`, contrôle d'accès | edge, core-internal, vpn-internal | aucun       |
| `vpn-frontend`  | interface (nginx, `/vpn/`)                                                 | edge                              | aucun       |
| `vpn-db`        | base MySQL du module                                                       | vpn-internal                      | aucun       |
| `vpn-wireguard` | interface `wg0`, pare-feu, NAT                                             | **vpn-egress uniquement**         | `NET_ADMIN` |

Le backend (exposé via Caddy) n'a **aucun privilège réseau** ; le conteneur WireGuard (privilégié) n'a **aucun
accès** aux bases ni au core. Ils ne communiquent que par un volume partagé : le backend décrit les pairs voulus,
le conteneur WireGuard les applique (`wg syncconf`) et publie l'état (dernier handshake, trafic).

### Chiffrement (cohérent avec le reste de Myprout)
- La paire de clés WireGuard d'un appareil est **générée dans le navigateur** (WebCrypto X25519). Le serveur ne reçoit que la clé publique.
- La configuration complète (avec la clé privée) est stockée **chiffrée** avec la clé du module (`HKDF(master_key, "module:vpn")`), pour pouvoir la ré-afficher. Le serveur ne peut pas la lire.
- Navigateur récent requis (X25519 dans WebCrypto : Chrome/Edge 133+, Firefox 130+, Safari 17+).

### Isolation réseau (dans `vpn-wireguard`)
- Les clients n'atteignent **aucune plage privée** (réseaux Docker, bases, core, box / LAN de l'hôte) : seulement Internet.
- Les clients ne se voient pas entre eux et ne joignent pas le conteneur lui-même.
- IPv6 : `AllowedIPs = 0.0.0.0/0, ::/0` côté client et aucun relais IPv6 côté serveur : l'IPv6 est bloqué plutôt que de fuiter hors du tunnel.

## Configuration (`.env`)

| Variable            | Rôle                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `MODULE_SECRET_VPN` | secret d'enregistrement : `openssl rand -hex 32`                       |
| `VPN_DB_*`          | base du module (mots de passe aléatoires)                              |
| `VPN_ENDPOINT`      | `votre-domaine:51820` : adresse publique vue par les appareils (défaut : hôte de `FRONTEND_URL`) |
| `VPN_ALLOWED_ROLES` | rôles autorisés en plus des admins (défaut `FAMILLE`)                  |
| `VPN_DNS`           | résolveurs donnés aux appareils (défaut `1.1.1.1, 1.0.0.1`)            |
| `VPN_MAX_DEVICES`   | appareils par utilisateur (défaut 5)                                   |

Avancé : `VPN_SUBNET` (défaut `10.8.0`, jusqu'à 253 appareils au total), `VPN_RECONCILE_MS` (défaut 60000).

## Mise en service

```bash
docker compose up -d --build          # les migrations du module s'appliquent au démarrage
sudo ufw allow 51820/udp              # + redirection du port si le serveur est derrière une box
```
Le module apparaît dans **Administration > Modules** après son premier démarrage. Les membres `FAMILLE`
le voient dans le lobby : ils installent l'application WireGuard, ajoutent un appareil, scannent le QR code.

## Points d'attention

- **Noyau** : l'hôte doit fournir WireGuard (Linux ≥ 5.6). Sinon `vpn-wireguard` s'arrête avec un message explicite.
- **Responsabilité** : le trafic sort avec votre IP. Le module ne conserve **aucun journal de navigation** ; seuls le dernier handshake et le volume échangé par appareil sont lus (jamais enregistrés).
- **Débit** : à domicile, le débit montant de votre connexion est partagé. Vérifiez l'absence de CGNAT (le port UDP serait injoignable) et vos CGU de FAI.
- **Pas de kill-switch serveur** : si le tunnel tombe, l'appareil repasse sur sa connexion normale. Activez « Bloquer les connexions hors VPN » (Android) / « On-demand » (iOS).
- **Sauvegarde** : la base est incluse dans `backup.sh`. La clé privée du serveur WireGuard est dans le volume `vpn_wg_key` ; si elle est perdue, **tous les appareils doivent être recréés** :
  `docker run --rm -v myprout_vpn_wg_key:/k alpine cat /k/server.key` (à stocker avec vos secrets).
- **Tests** : `npm test` et `npm run test:e2e` ne couvrent pas ce module. À vérifier à la main : IP publique une fois connecté ; `ping`/`curl` vers `core-db` ou votre LAN doivent échouer depuis le tunnel ; décocher le rôle FAMILLE coupe l'appareil en ~1 minute.

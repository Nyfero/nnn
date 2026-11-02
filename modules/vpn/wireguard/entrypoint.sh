#!/bin/sh
# Plan de données du VPN : interface WireGuard + NAT vers Internet.
# - /key     (volume privé) : clé privée du serveur, jamais partagée
# - /shared  (volume partagé avec vpn-backend) : peers.conf (lu), server.pub et status.txt (écrits)
set -eu

SUBNET="${VPN_SUBNET:-10.8.0}"
PORT=51820
KEY=/key/server.key
SHARED=/shared

mkdir -p /key "$SHARED"
[ -s "$KEY" ] || (umask 077 && wg genkey > "$KEY")
wg pubkey < "$KEY" > "$SHARED/server.pub"
chmod 644 "$SHARED/server.pub"

if [ "$(cat /proc/sys/net/ipv4/ip_forward)" != "1" ]; then
  echo "[vpn] net.ipv4.ip_forward doit valoir 1 (sysctls du service dans docker-compose.yml)" >&2
  exit 1
fi

if ! ip link add wg0 type wireguard 2>/dev/null; then
  echo "[vpn] Impossible de créer l'interface WireGuard : le noyau de l'hôte doit fournir WireGuard" >&2
  echo "[vpn] (noyau Linux >= 5.6, ou paquet wireguard-dkms) et le conteneur avoir NET_ADMIN." >&2
  exit 1
fi
ip addr add "$SUBNET.1/24" dev wg0
ip link set wg0 mtu 1420 up

# ───────── Pare-feu ─────────
IPT=iptables
$IPT -L -n >/dev/null 2>&1 || IPT=iptables-legacy

# Le conteneur lui-même n'est pas joignable depuis le tunnel
$IPT -A INPUT -i wg0 -j DROP
# Rien ne passe par défaut ; les clients ne se voient pas entre eux
$IPT -P FORWARD DROP
$IPT -A FORWARD -i wg0 -o wg0 -j DROP
# Jamais vers les réseaux privés : réseaux Docker (bases de données, core...), box / LAN de l'hôte
for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 169.254.0.0/16 127.0.0.0/8 224.0.0.0/4; do
  $IPT -A FORWARD -i wg0 -d "$net" -j DROP
done
# Le reste : Internet
$IPT -A FORWARD -i wg0 -j ACCEPT
$IPT -A FORWARD -o wg0 -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# L'IP de sortie est celle du serveur
$IPT -t nat -A POSTROUTING -s "$SUBNET.0/24" ! -o wg0 -j MASQUERADE
# Pas d'IPv6 dans le tunnel (les clients l'envoient dans le vide plutôt que de le laisser fuiter)
if command -v ip6tables >/dev/null 2>&1; then ip6tables -P FORWARD DROP 2>/dev/null || true; fi

echo "[vpn] wg0 prêt : $SUBNET.1/24, UDP $PORT, clé publique $(cat "$SHARED/server.pub")"

# ───────── Application des pairs ─────────
apply() {
  {
    printf '[Interface]\nPrivateKey = %s\nListenPort = %s\n\n' "$(cat "$KEY")" "$PORT"
    cat "$SHARED/peers.conf" 2>/dev/null || true
  } > /run/wg0.conf
  wg syncconf wg0 /run/wg0.conf
}

last=""
while true; do
  cur="$(cksum "$SHARED/peers.conf" 2>/dev/null || echo none)"
  if [ "$cur" != "$last" ]; then
    if apply; then
      last="$cur"
      echo "[vpn] pairs mis à jour ($(wg show wg0 peers | wc -l) actif(s))"
    else
      echo "[vpn] échec de l'application des pairs" >&2
    fi
  fi
  # État des pairs pour l'interface (la 1re ligne contient la clé privée : on la retire)
  if wg show wg0 dump | tail -n +2 > "$SHARED/status.txt.tmp"; then
    mv "$SHARED/status.txt.tmp" "$SHARED/status.txt"
  fi
  sleep 3
done

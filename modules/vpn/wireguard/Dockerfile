# Contexte de build : racine du repo
FROM alpine:3.20
RUN apk add --no-cache wireguard-tools iproute2 iptables iptables-legacy
COPY modules/vpn/wireguard/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
HEALTHCHECK --interval=15s --timeout=5s --retries=4 CMD wg show wg0 >/dev/null 2>&1 || exit 1
ENTRYPOINT ["/entrypoint.sh"]

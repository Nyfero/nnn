const toBase64 = (bytes) => btoa(String.fromCharCode(...bytes))

// Paire de clés WireGuard (Curve25519) générée par le navigateur : la clé privée ne quitte jamais l'appareil.
// WebCrypto n'exporte une clé privée X25519 qu'au format PKCS#8 : les 32 derniers octets sont la clé brute.
export async function generateKeypair() {
  const pair = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  return {
    privateKey: toBase64(pkcs8.slice(-32)),
    publicKey: toBase64(publicRaw),
  }
}

// Tunnel complet : tout le trafic IPv4 passe par le serveur ; ::/0 bloque l'IPv6 (pas de fuite)
export function buildConfig({ privateKey, address, dns, serverPublicKey, endpoint }) {
  return [
    '[Interface]',
    `PrivateKey = ${privateKey}`,
    `Address = ${address}/32`,
    `DNS = ${dns}`,
    '',
    '[Peer]',
    `PublicKey = ${serverPublicKey}`,
    'AllowedIPs = 0.0.0.0/0, ::/0',
    `Endpoint = ${endpoint}`,
    'PersistentKeepalive = 25',
    '',
  ].join('\n')
}

// WireGuard pour Windows limite le nom du tunnel (= nom du fichier) à 15 caractères simples
export function configFileName(deviceName) {
  const slug = deviceName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 12)
  return `mp-${slug || 'vpn'}.conf`
}

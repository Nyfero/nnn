// Utilitaires des tests de bout en bout : client HTTP avec cookies, boîte mail de capture, chiffrement.
import assert from 'node:assert/strict'

export const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost').replace(/\/$/, '')
export const E2E_TOKEN = process.env.E2E_TOKEN
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Client avec "cookie jar" minimal (Node ne gère pas les cookies) et jeton d'accès
export class Client {
  constructor(label = 'client') {
    this.label = label
    this.cookies = new Map() // name -> { value, path }
    this.token = null
  }

  cookie(name) {
    return this.cookies.get(name)?.value
  }

  async req(method, path, body, { auth = true, headers = {} } = {}) {
    const h = { ...headers }
    if (body !== undefined) h['Content-Type'] = 'application/json'
    if (auth && this.token) h.Authorization = `Bearer ${this.token}`
    const cookie = [...this.cookies]
      .filter(([, c]) => path.startsWith(c.path))
      .map(([n, c]) => `${n}=${c.value}`)
      .join('; ')
    if (cookie) h.Cookie = cookie

    const res = await fetch(BASE + path, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    })

    const setCookies = res.headers.getSetCookie?.() ?? []
    for (const sc of setCookies) {
      const [pair, ...attrs] = sc.split(';').map((s) => s.trim())
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      const pathAttr = attrs.find((a) => a.toLowerCase().startsWith('path='))?.slice(5) ?? '/'
      const expired = attrs.some((a) => /^expires=.*1970/i.test(a) || /^max-age=0$/i.test(a))
      if (!value || expired) this.cookies.delete(name)
      else this.cookies.set(name, { value, path: pathAttr })
    }

    let data = null
    const text = await res.text()
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { status: res.status, data, res, setCookies }
  }

  get = (p, o) => this.req('GET', p, undefined, o)
  post = (p, b, o) => this.req('POST', p, b ?? {}, o)
  put = (p, b, o) => this.req('PUT', p, b ?? {}, o)
  patch = (p, b, o) => this.req('PATCH', p, b ?? {}, o)
  del = (p, b, o) => this.req('DELETE', p, b, o)

  // Connexion au core ; renvoie la réponse complète
  async login(email, password) {
    const r = await this.post('/api/core/auth/login', { email, password }, { auth: false })
    if (r.status === 200) this.token = r.data.token
    return r
  }
}

// ───────── Boîte mail de capture (E2E_MODE côté core) ─────────
async function mailbox(to) {
  const res = await fetch(`${BASE}/api/core/_e2e/mailbox${to ? `?to=${encodeURIComponent(to)}` : ''}`, {
    headers: { 'X-E2E-Token': E2E_TOKEN ?? '' },
  })
  if (res.status === 404) {
    throw new Error(
      "Boîte mail E2E inaccessible : lancez la stack avec docker-compose.e2e.yml et définissez E2E_TOKEN dans .env"
    )
  }
  return res.json()
}

// Attend un mail (le plus récent) dont le sujet contient `subject`, publié après `since`
export async function waitForMail(to, subject, since = 0, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const mail = (await mailbox(to)).find((m) => m.subject.includes(subject) && m.at >= since)
    if (mail) return mail
    await sleep(250)
  }
  throw new Error(`Aucun mail "${subject}" reçu par ${to} (backend mal configuré ou template manquant ?)`)
}

export async function expectNoMail(to, since, waitMs = 1000) {
  await sleep(waitMs)
  const mails = (await mailbox(to)).filter((m) => m.at >= since)
  assert.equal(mails.length, 0, `Aucun mail attendu pour ${to}`)
}

// Extrait token et mode d'un lien d'email
export function parseLink(link) {
  const url = new URL(link)
  return { token: url.searchParams.get('token'), mode: url.searchParams.get('mode'), pathname: url.pathname }
}

// ───────── Chiffrement des mots de passe du module (même format que l'interface) ─────────
export async function encryptEntry(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text))
  )
  const combined = new Uint8Array(iv.length + enc.length)
  combined.set(iv, 0)
  combined.set(enc, iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptEntry(b64, key) {
  const combined = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const dec = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: combined.slice(0, 12) },
    key,
    combined.slice(12)
  )
  return new TextDecoder().decode(dec)
}

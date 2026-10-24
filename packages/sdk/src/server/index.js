import crypto from 'node:crypto'

// ───────── Authentification via le core ─────────
// Le module transmet le Bearer de l'utilisateur au core (POST /api/core/introspect),
// qui valide la signature, la session (révocation) et l'accès à CE module.
// Les réponses positives sont mises en cache quelques secondes.
export function coreAuth({
  coreUrl,
  moduleId,
  moduleSecret,
  cacheTtlMs = 5000,
}) {
  const cache = new Map()

  return async function coreAuthMiddleware(req, res, next) {
    try {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) {
        return res
          .status(401)
          .json({ error: 'Token manquant', code: 'TOKEN_INVALID' })
      }

      const key = crypto.createHash('sha256').update(header).digest('hex')
      const now = Date.now()
      const hit = cache.get(key)
      if (hit && hit.expires > now) {
        req.user = hit.user
        return next()
      }

      let response
      try {
        response = await fetch(`${coreUrl}/api/core/introspect`, {
          method: 'POST',
          headers: {
            Authorization: header,
            'X-Module-Id': moduleId,
            'X-Module-Secret': moduleSecret,
          },
          signal: AbortSignal.timeout(5000),
        })
      } catch {
        return res.status(503).json({ error: 'Le core est indisponible' })
      }

      if (response.status === 401) {
        cache.delete(key)
        // Le code TOKEN_INVALID déclenche le refresh automatique côté client
        return res
          .status(401)
          .json({ error: 'Token invalide ou révoqué', code: 'TOKEN_INVALID' })
      }
      if (response.status === 403) {
        return res.status(403).json({ error: 'Accès à ce module non autorisé' })
      }
      if (!response.ok) {
        return res.status(502).json({ error: 'Réponse inattendue du core' })
      }

      const data = await response.json()
      const user = {
        user_id: data.user_id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        isAdmin: !!data.isAdmin,
      }

      if (cache.size > 1000) {
        for (const [k, v] of cache) if (v.expires < now) cache.delete(k)
        if (cache.size > 1000) cache.clear()
      }
      cache.set(key, { user, expires: now + cacheTtlMs })

      req.user = user
      next()
    } catch (err) {
      next(err)
    }
  }
}

// ───────── Appels du core vers le module (ex: purge d'un utilisateur supprimé) ─────────
export function requireModuleSecret(secret) {
  const expected = Buffer.from(secret)
  return function requireModuleSecretMiddleware(req, res, next) {
    const provided = Buffer.from(req.header('X-Module-Secret') ?? '')
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return res.status(401).json({ error: 'Non autorisé' })
    }
    next()
  }
}

// ───────── Enregistrement auprès du core ─────────
// Retente jusqu'à réussir (le core peut démarrer après le module), puis se ré-annonce
// périodiquement : l'admin voit ainsi « vu pour la dernière fois ».
export function registerModule({
  coreUrl,
  id,
  secret,
  name,
  icon,
  path,
  version,
  internalUrl,
  heartbeatMs = 5 * 60 * 1000,
  log = console,
}) {
  let delay = 1000
  let registered = false
  let timer = null
  let stopped = false

  const attempt = async () => {
    if (stopped) return
    try {
      const res = await fetch(`${coreUrl}/api/core/modules/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Module-Id': id,
          'X-Module-Secret': secret,
        },
        body: JSON.stringify({
          name,
          icon,
          path,
          version,
          internal_url: internalUrl,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      if (!registered) log.log(`[module:${id}] enregistré auprès du core`)
      registered = true
      delay = 1000
      timer = setTimeout(attempt, heartbeatMs)
    } catch (err) {
      log.warn(
        `[module:${id}] enregistrement impossible (${err.message}), nouvel essai dans ${delay / 1000}s`
      )
      timer = setTimeout(attempt, delay)
      delay = Math.min(delay * 2, 30000)
    }
  }

  attempt()
  return {
    stop() {
      stopped = true
      clearTimeout(timer)
    },
  }
}

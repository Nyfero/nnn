# @myprout/sdk

Code partagé entre le core et les modules.

## Côté serveur (`@myprout/sdk/server`)
- `coreAuth({ coreUrl, cacheTtlMs })` : middleware Express. Envoie le Bearer à `POST /api/core/introspect`,
  remplit `req.user = { user_id, isAdmin, modules }` et refuse si le module n'est pas autorisé pour l'utilisateur.
- `registerModule({ coreUrl, id, name, icon, path, version, secret })` : appelé au démarrage, avec retry.

## Côté client (`@myprout/sdk/client`)
- `getModuleKey(moduleId)` : lit la clé maître (CryptoKey HKDF non extractable) dans IndexedDB
  et dérive la clé AES-GCM du module via `HKDF(master_key, "module:<id>")`.
- `coreApi` : instance axios pointant sur `/api/core` avec refresh automatique du token.

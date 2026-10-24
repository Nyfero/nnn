// Accepte uniquement un chemin local ("/passwords/"), jamais une URL externe
export const safeRedirect = (r) =>
  typeof r === 'string' && /^\/(?![/\\])/.test(r) ? r : null

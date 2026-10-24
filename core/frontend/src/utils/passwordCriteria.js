export const passwordCriteria = (pw = '') => ({
  length: pw.length >= 8,
  upper: /[A-Z]/.test(pw),
  number: /[0-9]/.test(pw),
  special: /[^A-Za-z0-9]/.test(pw),
})

export const meetsCriteria = (pw) => Object.values(passwordCriteria(pw)).every(Boolean)

// Exigé uniquement dans le build de production (pratique pour tester en dev)
export const ENFORCE_PASSWORD_CRITERIA = import.meta.env.PROD

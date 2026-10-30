const UNITS: Record<string, number> = { '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }

// "5GB", "500 MB", "1.5TiB", "1024" -> octets (base 1024)
export function parseSize(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([kmgt]?)(?:i?b)?\s*$/i.exec(value)
  if (!m) throw new Error(`Taille invalide : "${value}" (exemples : 500MB, 5GB, 1TB)`)
  return Math.floor(parseFloat(m[1].replace(',', '.')) * UNITS[m[2].toLowerCase()])
}

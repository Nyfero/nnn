// Logique pure de la liste de mots de passe (filtre, regroupement, domaines) : testable sans Vue

// Filtre par titre ou identifiant (insensible à la casse)
export const filterPasswords = (list, search) => {
  if (!search) return list
  const q = search.toLowerCase()
  return list.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
  )
}

// Regroupe par initiale du titre : [{ letter, passwords }] trié par lettre
export const groupByLetter = (list) => {
  const groups = {}
  list.forEach((p) => {
    const letter = p.title[0].toUpperCase()
    if (!groups[letter]) groups[letter] = []
    groups[letter].push(p)
  })
  return Object.keys(groups)
    .sort()
    .map((letter) => ({
      letter,
      passwords: groups[letter],
    }))
}

// Déduit un nom de domaine du titre d'une entrée ("github", "GitHub.com", "https://x.fr/a")
export const extractDomain = (value) => {
  if (!value) return null
  try {
    let domain = value.trim().toLowerCase()
    if (value.startsWith('http')) domain = new URL(value).hostname
    if (!domain.includes('.')) domain = `${domain}.com`
    return domain
  } catch {
    return null
  }
}

export const isValidDomain = (domain) => {
  return (
    domain && domain.length > 4 && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)
  )
}

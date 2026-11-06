#!/usr/bin/env node
// Hook PreToolUse (Edit|Write|MultiEdit) : refuse la modification de fichiers qui ne doivent
// jamais être écrits à la main. Un code de sortie 2 bloque l'appel et renvoie le message à Claude.
import { readFileSync } from 'node:fs'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0) // entrée illisible : on ne bloque pas
}

const raw = input?.tool_input?.file_path
if (typeof raw !== 'string') process.exit(0)
const path = raw.replaceAll('\\', '/')

const rules = [
  {
    test: (p) => /(^|\/)\.env$/.test(p) || /(^|\/)\.env\.(?!example$)[^/]+$/.test(p),
    message: 'Le fichier .env contient des secrets : ne pas le modifier. Mettre à jour .env.example et demander à l\'utilisateur de reporter la valeur dans son .env.',
  },
  {
    test: (p) => /(^|\/)secrets\//.test(p) && !/(^|\/)secrets\/\.gitkeep$/.test(p),
    message: 'Le dossier secrets/ contient les clés JWT : ne pas y écrire. Elles se génèrent avec ./scripts/gen-keys.sh.',
  },
  {
    test: (p) => /(^|\/)prisma\/migrations\//.test(p),
    message: 'Les migrations Prisma sont générées (prisma migrate dev) et une migration appliquée ne se modifie jamais. Modifier schema.prisma puis générer la migration (skill db-migration), ou demander à l\'utilisateur.',
  },
]

for (const rule of rules) {
  if (rule.test(path)) {
    process.stderr.write(`Modification refusée (${path}) : ${rule.message}\n`)
    process.exit(2)
  }
}
process.exit(0)

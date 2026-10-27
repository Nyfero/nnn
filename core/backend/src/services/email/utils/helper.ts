import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const TEMPLATE_DIR = fileURLToPath(new URL('../template/', import.meta.url))

export async function loadEmailTemplate(templateName: string): Promise<string> {
  const templatePath = path.join(TEMPLATE_DIR, `${templateName}.html`)
  try {
    return await readFile(templatePath, 'utf-8')
  } catch {
    throw new Error(
      `Template email introuvable : ${templatePath} (voir template/README.md)`
    )
  }
}

export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

// Les valeurs (prénom saisi par l'utilisateur, liens...) sont échappées : aucune injection HTML possible.
// Le remplaçant est une fonction pour que "$&" ou "$1" dans une valeur ne soient pas interprétés.
export function replaceVariables(
  html: string,
  variables: Record<string, string | number>
): string {
  return Object.entries(variables).reduce(
    (acc, [key, value]) =>
      acc.replaceAll(`{{${key}}}`, () => escapeHtml(String(value))),
    html
  )
}

// Liens http(s) d'un email (dé-échappés), pour les logs de dev et les tests
export function extractLinks(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1].replaceAll('&amp;', '&'))
    .filter((l) => l.startsWith('http'))
}

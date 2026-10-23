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

export function replaceVariables(
  html: string,
  variables: Record<string, string | number>
): string {
  return Object.entries(variables).reduce(
    (acc, [key, value]) => acc.replaceAll(`{{${key}}}`, String(value)),
    html
  )
}

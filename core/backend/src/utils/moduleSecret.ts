// Secret d'enregistrement d'un module : variable d'environnement MODULE_SECRET_<ID>
// (id en majuscules, "-" remplacé par "_"). Sans dépendance : testable seul.
export function getModuleSecret(moduleId: string): string | undefined {
  return process.env[
    `MODULE_SECRET_${moduleId.toUpperCase().replace(/-/g, '_')}`
  ]
}

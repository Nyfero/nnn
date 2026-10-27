// Boîte mail en mémoire, utilisée UNIQUEMENT quand E2E_MODE=true (tests de bout en bout).
// Interdit en production (voir src/index.ts).
export interface CapturedMail {
  to: string
  subject: string
  links: string[]
  at: number
}

const box: CapturedMail[] = []

export function captureMail(mail: Omit<CapturedMail, 'at'>) {
  box.unshift({ ...mail, at: Date.now() })
  if (box.length > 200) box.length = 200
}

export const readMailbox = (to?: string) =>
  box.filter((m) => !to || m.to.toLowerCase() === to.toLowerCase())

export const clearMailbox = () => {
  box.length = 0
}

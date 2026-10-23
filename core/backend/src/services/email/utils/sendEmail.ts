import nodemailer from 'nodemailer'
import { Resend } from 'resend'

const isProd = process.env.NODE_ENV === 'production'
const sender = 'Myprout <noreply@myprout.fr>'

// ── Dev : Ethereal (boîte factice, rien n'est jamais livré) ──
// Créé à la demande, jamais en production. Si Ethereal est injoignable,
// le mail est simplement affiché dans la console.
let devTransporter: Promise<nodemailer.Transporter> | null = null

function getDevTransporter() {
  devTransporter ??= nodemailer
    .createTestAccount()
    .then((acc) =>
      nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: { user: acc.user, pass: acc.pass },
      })
    )
    .catch((err) => {
      console.warn('[EMAIL] Ethereal indisponible, mails affichés en console :', err.message)
      return nodemailer.createTransport({ jsonTransport: true })
    })
  return devTransporter
}

// ── Prod : Resend ──
let resend: Resend | null = null
const getResend = () => {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY manquante')
  return (resend ??= new Resend(process.env.RESEND_API_KEY))
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  templateId?: string,
  templateVariables?: Record<string, string | number>
) {
  if (isProd && templateId) {
    const { error } = await getResend().emails.send({
      from: sender,
      to,
      subject,
      template: { id: templateId, variables: templateVariables ?? {} },
    })
    if (error) throw new Error(`Resend : ${error.message}`)
    return
  }

  const info = await (await getDevTransporter()).sendMail({ from: sender, to, subject, html })
  const links = [...html.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((l) => l.startsWith('http'))
  console.log(`[EMAIL DEV] → ${to} | ${subject}`)
  const preview = nodemailer.getTestMessageUrl(info)
  if (preview) console.log(`[EMAIL DEV] Aperçu : ${preview}`)
  links.forEach((l) => console.log(`[EMAIL DEV] Lien : ${l}`))
}

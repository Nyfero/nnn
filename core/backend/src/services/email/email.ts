import { sendEmail } from './utils/sendEmail'
import { loadEmailTemplate, replaceVariables } from './utils/helper'

const isProd = process.env.NODE_ENV === 'production'

interface Mail {
  to: string
  title: string
  prodTemplate: string // identifiant du template Resend
  devTemplate: string // nom du fichier HTML local
  variables: Record<string, string | number>
}

async function send({ to, title, prodTemplate, devTemplate, variables }: Mail) {
  if (isProd) {
    return sendEmail(to, title, '', prodTemplate, variables)
  }
  const html = replaceVariables(await loadEmailTemplate(devTemplate), variables)
  return sendEmail(to, title, html)
}

type MailUser = { firstName: string; lastName?: string; email: string; created_at?: Date }

// ADMIN : nouvelle inscription à valider
export function sendRequestInscriptionToAdmin(user: MailUser) {
  return send({
    to: process.env.ADMIN_EMAIL!,
    title: "Demande d'inscription de " + user.firstName,
    prodTemplate: 'new-user-registration-1',
    devTemplate: 'Admin',
    variables: {
      firstName: user.firstName,
      lastName: user.lastName ?? '',
      email: user.email,
      date: (user.created_at ?? new Date()).toLocaleString('fr-FR'),
      adminURL: `${process.env.FRONTEND_URL}/admin`,
    },
  })
}

// EMAIL VERIFICATION
export function sendConfirmEmailToUser(user: MailUser, token: string) {
  return send({
    to: user.email,
    title: 'Confirmer votre adresse email',
    prodTemplate: 'email-validation',
    devTemplate: 'EmailValidation',
    variables: {
      firstName: user.firstName,
      confirmMailRoute: `${process.env.FRONTEND_URL}/login?token=${token}&mode=email`,
    },
  })
}

// ACTIVATE
export function sendAccountSetupToUser(user: MailUser, token: string) {
  return send({
    to: user.email,
    title: 'Définissez votre mot de passe',
    prodTemplate: 'account-verified',
    devTemplate: 'Activate',
    variables: {
      firstName: user.firstName,
      setupLinkURL: `${process.env.FRONTEND_URL}/login?token=${token}&mode=set`,
    },
  })
}

// REFUSE
export function sendRejectedToUser(user: MailUser) {
  return send({
    to: user.email,
    title: 'Votre demande a été refusée',
    prodTemplate: 'account-rejected',
    devTemplate: 'Refuse',
    variables: { firstName: user.firstName },
  })
}

// RECOVERY
export function sendRecoveryToUser(user: MailUser, token: string) {
  return send({
    to: user.email,
    title: 'Réinitialisez votre mot de passe (valable 1h)',
    prodTemplate: 'password-reset',
    devTemplate: 'Recovery',
    variables: {
      firstName: user.firstName,
      recoveryURL: `${process.env.FRONTEND_URL}/login?token=${token}&mode=reset`,
    },
  })
}

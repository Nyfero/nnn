import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../prisma'
import { Prisma } from '@prisma/client'
import { TOKEN_TYPES, TTL } from '../config'
import { ah } from '../utils/asyncHandler'
import { hashToken, randomToken } from '../utils/jwt'
import {
  isKeyBlob,
  isQA,
  isQuestionList,
  isSalt,
  isStr,
  normalizeAnswer,
  normalizeEmail,
} from '../utils/validators'
import { authMiddleware } from '../middlewares/authMiddleware'
import { rateLimit } from '../middlewares/rateLimit'
import { hasAdminRole, notifyUserDeleted } from '../services/access'
import { issueToken, lookupToken } from '../services/tokens'
import {
  REFRESH_COOKIE,
  buildAuthResponse,
  clearRefreshCookie,
  createSession,
  setRefreshCookie,
} from '../services/sessions'
import {
  sendConfirmEmailToUser,
  sendRecoveryToUser,
  sendRequestInscriptionToAdmin,
} from '../services/email/email'

const router = Router()
const MIN = 60 * 1000

const loginLimiter = rateLimit(15 * MIN, 10)
const sensitiveLimiter = rateLimit(15 * MIN, 10)
const forgotLimiter = rateLimit(15 * MIN, 5)
const registerLimiter = rateLimit(60 * MIN, 10)

// ─── REGISTER ────────────────────────────────────────────────────────────────
router.post(
  '/register',
  registerLimiter,
  ah(async (req, res) => {
    const { firstName, lastName, email: rawEmail } = req.body ?? {}
    if (
      !isStr(firstName, 100) ||
      !isStr(lastName, 100) ||
      !isStr(rawEmail, 190)
    ) {
      return res.status(400).json({ error: 'Champs manquants' })
    }
    if (/[<>]/.test(firstName) || /[<>]/.test(lastName)) {
      return res
        .status(400)
        .json({ error: 'Caractères non autorisés dans le nom' })
    }
    const email = normalizeEmail(rawEmail)

    // L'unicité est garantie par la base (UNIQUE) : pas de course possible entre
    // deux inscriptions simultanées, et une adresse non vérifiée reste « prise ».
    let user
    try {
      user = await prisma.users.create({
        data: { email, firstName: firstName.trim(), lastName: lastName.trim() },
      })
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return res
          .status(409)
          .json({ error: 'Cet email est déjà utilisé', code: 'EMAIL_TAKEN' })
      }
      throw e
    }

    const token = await issueToken(
      user.user_id,
      TOKEN_TYPES.EMAIL_VERIFICATION,
      TTL.EMAIL_VERIFICATION_MS
    )
    await sendConfirmEmailToUser(user, token)

    res.status(201).json({
      message:
        "Pour valider l'inscription, merci de confirmer votre adresse email grâce à l'email qui vous a été envoyé.",
    })
  })
)

// ─── VERIFY EMAIL ────────────────────────────────────────────────────────────
router.post(
  '/verify-email',
  ah(async (req, res) => {
    const found = await lookupToken(
      req.body?.token,
      TOKEN_TYPES.EMAIL_VERIFICATION
    )
    if (!found.ok) return res.status(found.status).json({ error: found.error })

    const { record } = found
    const user = record.user
    if (user.is_email_verified) {
      return res.status(400).json({ error: 'Email déjà vérifié' })
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { user_id: user.user_id },
        data: { is_email_verified: true },
      }),
      prisma.tokens.delete({ where: { token_id: record.token_id } }),
    ])

    await sendRequestInscriptionToAdmin(user).catch((e) =>
      console.error('Erreur envoi email admin :', e)
    )

    res.json({
      message: 'Email vérifié. En attente de validation par un administrateur.',
    })
  })
)

// ─── ACTIVATE ────────────────────────────────────────────────────────────────
// Le client génère la clé maître et envoie uniquement ses deux versions chiffrées.
router.post(
  '/activate',
  sensitiveLimiter,
  ah(async (req, res) => {
    const {
      token,
      password,
      security_questions,
      encrypted_master_key,
      kek_salt,
      recovery_encrypted_master_key,
      recovery_kek_salt,
    } = req.body ?? {}

    if (
      !isStr(password, 256) ||
      !isQuestionList(security_questions) ||
      !isKeyBlob(encrypted_master_key) ||
      !isKeyBlob(recovery_encrypted_master_key) ||
      !isSalt(kek_salt) ||
      !isSalt(recovery_kek_salt)
    ) {
      return res.status(400).json({ error: 'Champs manquants ou invalides' })
    }

    const found = await lookupToken(token, TOKEN_TYPES.ACTIVATE)
    if (!found.ok) return res.status(found.status).json({ error: found.error })
    const { record } = found

    const [password_hash, recovery_questions] = await Promise.all([
      bcrypt.hash(password, 12),
      Promise.all(
        security_questions.map(async (q) => ({
          question: q.question.trim(),
          answer_hash: await bcrypt.hash(normalizeAnswer(q.answer), 12),
        }))
      ),
    ])

    await prisma.$transaction([
      prisma.users.update({
        where: { user_id: record.user_id },
        data: {
          password_hash,
          is_active: true,
          encrypted_master_key,
          kek_salt,
          recovery_questions,
          recovery_encrypted_master_key,
          recovery_kek_salt,
        },
      }),
      prisma.tokens.delete({ where: { token_id: record.token_id } }),
    ])

    res.json({
      message:
        'Mot de passe défini avec succès. Vous pouvez maintenant vous connecter.',
    })
  })
)

// ─── LOGIN ───────────────────────────────────────────────────────────────────
router.post(
  '/login',
  loginLimiter,
  ah(async (req, res) => {
    const { email, password } = req.body ?? {}
    if (!isStr(email, 190) || !isStr(password, 256)) {
      return res.status(400).json({ error: 'Champs manquants' })
    }

    const user = await prisma.users.findUnique({
      where: { email: normalizeEmail(email) },
    })
    if (!user)
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })

    if (!user.is_email_verified) {
      return res
        .status(403)
        .json({ error: "Votre adresse mail n'est pas vérifiée" })
    }
    if (!user.is_active) {
      return res.status(403).json({
        error:
          'Votre compte est en attente de validation par un administrateur',
      })
    }
    if (!user.password_hash) {
      return res.status(403).json({
        error: "Vous devez d'abord définir votre mot de passe via l'email reçu",
      })
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
    }

    const session = await createSession(user.user_id, res)
    res.json(await buildAuthResponse(user.user_id, session.session_id))
  })
)

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
router.post(
  '/logout',
  ah(async (req, res) => {
    const refresh = req.cookies?.[REFRESH_COOKIE]
    if (typeof refresh === 'string') {
      await prisma.sessions.deleteMany({
        where: { refresh_hash: hashToken(refresh) },
      })
    }
    clearRefreshCookie(res)
    res.json({ success: true })
  })
)

// ─── REFRESH ─────────────────────────────────────────────────────────────────
router.post(
  '/refresh',
  ah(async (req, res) => {
    const refresh = req.cookies?.[REFRESH_COOKIE]
    if (typeof refresh !== 'string') {
      return res.status(401).json({ error: 'Refresh token manquant' })
    }
    const hash = hashToken(refresh)

    let session = await prisma.sessions.findUnique({
      where: { refresh_hash: hash },
    })
    let rotate = true

    if (!session) {
      // Refresh concurrent (autre onglet / autre module) : l'ancien token reste
      // valable quelques secondes, sans rotation supplémentaire
      session = await prisma.sessions.findFirst({
        where: {
          prev_refresh_hash: hash,
          rotated_at: { gt: new Date(Date.now() - TTL.REFRESH_GRACE_MS) },
        },
      })
      rotate = false
    }

    if (!session) {
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Refresh token invalide' })
    }
    if (session.expires_at < new Date()) {
      await prisma.sessions.delete({
        where: { session_id: session.session_id },
      })
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Refresh token expiré' })
    }

    const user = await prisma.users.findUnique({
      where: { user_id: session.user_id },
    })
    if (!user?.is_active) {
      clearRefreshCookie(res)
      return res.status(401).json({ error: 'Compte inactif' })
    }

    if (rotate) {
      const next = randomToken()
      await prisma.sessions.update({
        where: { session_id: session.session_id },
        data: {
          prev_refresh_hash: hash,
          refresh_hash: hashToken(next),
          rotated_at: new Date(),
          expires_at: new Date(Date.now() + TTL.REFRESH_MS),
        },
      })
      setRefreshCookie(res, next)
    }

    res.json(await buildAuthResponse(session.user_id, session.session_id))
  })
)

// ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────
// Le client déchiffre la clé maître avec l'ancien mot de passe, la rechiffre avec
// le nouveau (nouveau sel) et envoie le nouveau blob. Les modules n'ont rien à migrer.
router.put(
  '/password',
  authMiddleware,
  sensitiveLimiter,
  ah(async (req, res) => {
    const { oldPassword, newPassword, encrypted_master_key, kek_salt } =
      req.body ?? {}
    if (
      !isStr(oldPassword, 256) ||
      !isStr(newPassword, 256) ||
      !isKeyBlob(encrypted_master_key) ||
      !isSalt(kek_salt)
    ) {
      return res.status(400).json({ error: 'Champs manquants ou invalides' })
    }

    const user = await prisma.users.findUnique({
      where: { user_id: req.user!.user_id },
    })
    if (!user?.password_hash)
      return res.status(404).json({ error: 'Utilisateur introuvable' })

    if (!(await bcrypt.compare(oldPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Ancien mot de passe incorrect' })
    }

    await prisma.$transaction([
      prisma.users.update({
        where: { user_id: user.user_id },
        data: {
          password_hash: await bcrypt.hash(newPassword, 12),
          encrypted_master_key,
          kek_salt,
        },
      }),
      // Déconnecte les autres appareils
      prisma.sessions.deleteMany({
        where: { user_id: user.user_id, session_id: { not: req.user!.sid } },
      }),
    ])

    res.json({
      message: 'Mot de passe modifié avec succès',
      encrypted_master_key,
      kek_salt,
    })
  })
)

// ─── VERIFY PASSWORD ─────────────────────────────────────────────────────────
router.post(
  '/password/verify',
  authMiddleware,
  sensitiveLimiter,
  ah(async (req, res) => {
    const { password } = req.body ?? {}
    if (!isStr(password, 256))
      return res.status(400).json({ error: 'Champs manquants' })

    const user = await prisma.users.findUnique({
      where: { user_id: req.user!.user_id },
    })
    if (
      !user?.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({ error: 'Mot de passe incorrect' })
    }
    res.json({ valid: true })
  })
)

// ─── FORGOT PASSWORD (envoi du mail) ─────────────────────────────────────────
router.post(
  '/password/forgot',
  forgotLimiter,
  ah(async (req, res) => {
    const { email } = req.body ?? {}
    if (!isStr(email, 190))
      return res.status(400).json({ error: 'Champ manquant' })

    // Réponse identique que le compte existe ou non (pas d'énumération)
    const user = await prisma.users.findFirst({
      where: {
        email: normalizeEmail(email),
        is_active: true,
        password_hash: { not: null },
      },
    })
    if (user) {
      try {
        const token = await issueToken(
          user.user_id,
          TOKEN_TYPES.PASSWORD_RESET,
          TTL.RESET_MS
        )
        await sendRecoveryToUser(user, token)
      } catch (e) {
        console.error('Erreur envoi email recovery :', e)
      }
    }
    res.json({ success: true })
  })
)

// ─── RECOVERY : questions de sécurité ────────────────────────────────────────
router.get(
  '/recovery',
  sensitiveLimiter,
  ah(async (req, res) => {
    const found = await lookupToken(req.query.token, TOKEN_TYPES.PASSWORD_RESET)
    if (!found.ok) return res.status(found.status).json({ error: found.error })

    const stored = found.record.user.recovery_questions as
      | { question: string }[]
      | null
    if (!stored?.length)
      return res.status(404).json({ error: 'Aucune question de sécurité' })

    res.json({ questions: stored.map((q) => q.question) })
  })
)

// ─── RECOVERY : vérification des réponses ────────────────────────────────────
router.post(
  '/recovery/verify',
  sensitiveLimiter,
  ah(async (req, res) => {
    const { token, security_questions } = req.body ?? {}
    const found = await lookupToken(token, TOKEN_TYPES.PASSWORD_RESET)
    if (!found.ok) return res.status(found.status).json({ error: found.error })
    const { record } = found
    const user = record.user

    const stored = user.recovery_questions as
      | { question: string; answer_hash: string }[]
      | null
    if (
      !stored?.length ||
      !user.recovery_encrypted_master_key ||
      !user.recovery_kek_salt
    ) {
      return res.status(404).json({ error: 'Aucune question de sécurité' })
    }
    // Toutes les questions enregistrées doivent être répondues
    if (
      !Array.isArray(security_questions) ||
      security_questions.length !== stored.length ||
      !security_questions.every(isQA)
    ) {
      return res.status(400).json({ error: 'Champs manquants' })
    }

    const norm = (s: string) => s.trim().toLowerCase()
    const results = await Promise.all(
      stored.map(async (s) => {
        const incoming = security_questions.find(
          (i) => norm(i.question) === norm(s.question)
        )
        return incoming
          ? bcrypt.compare(normalizeAnswer(incoming.answer), s.answer_hash)
          : false
      })
    )
    if (!results.every(Boolean)) {
      return res.status(401).json({ error: 'Réponses incorrectes' })
    }

    // Le token passe en "vérifié" (durée courte) : seul lui autorise le reset effectif
    await prisma.tokens.update({
      where: { token_id: record.token_id },
      data: {
        type: TOKEN_TYPES.PASSWORD_RESET_VERIFIED,
        expires_at: new Date(Date.now() + TTL.RESET_VERIFIED_MS),
      },
    })

    res.json({
      success: true,
      recovery_encrypted_master_key: user.recovery_encrypted_master_key,
      recovery_kek_salt: user.recovery_kek_salt,
    })
  })
)

// ─── RESET PASSWORD ──────────────────────────────────────────────────────────
// Le client a déchiffré la clé maître avec les réponses, puis la rechiffre avec
// la KEK du nouveau mot de passe (nouveau sel).
router.put(
  '/password/reset',
  sensitiveLimiter,
  ah(async (req, res) => {
    const { token, password, encrypted_master_key, kek_salt } = req.body ?? {}
    if (
      !isStr(password, 256) ||
      !isKeyBlob(encrypted_master_key) ||
      !isSalt(kek_salt)
    ) {
      return res.status(400).json({ error: 'Champs manquants ou invalides' })
    }

    const found = await lookupToken(token, TOKEN_TYPES.PASSWORD_RESET_VERIFIED)
    if (!found.ok) return res.status(found.status).json({ error: found.error })
    const { record } = found

    await prisma.$transaction([
      prisma.users.update({
        where: { user_id: record.user_id },
        data: {
          password_hash: await bcrypt.hash(password, 12),
          encrypted_master_key,
          kek_salt,
        },
      }),
      prisma.tokens.delete({ where: { token_id: record.token_id } }),
      // Révoque toutes les sessions existantes
      prisma.sessions.deleteMany({ where: { user_id: record.user_id } }),
    ])

    res.json({
      message:
        'Mot de passe modifié avec succès. Vous pouvez maintenant vous connecter.',
    })
  })
)

// ─── DELETE ACCOUNT ──────────────────────────────────────────────────────────
router.delete(
  '/account',
  authMiddleware,
  sensitiveLimiter,
  ah(async (req, res) => {
    const { password } = req.body ?? {}
    if (!isStr(password, 256))
      return res.status(400).json({ error: 'Champs manquants' })

    const user = await prisma.users.findUnique({
      where: { user_id: req.user!.user_id },
      include: { userRoles: { include: { role: true } } },
    })
    if (!user?.password_hash)
      return res.status(404).json({ error: 'Utilisateur introuvable' })
    if (hasAdminRole(user)) {
      return res
        .status(403)
        .json({ error: 'Un compte administrateur ne peut pas être supprimé' })
    }
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Mot de passe incorrect' })
    }

    // Les modules purgent leurs données, puis le core supprime l'utilisateur (cascade)
    await notifyUserDeleted(user.user_id)
    await prisma.users.delete({ where: { user_id: user.user_id } })
    clearRefreshCookie(res)

    res.json({ message: 'Compte supprimé avec succès' })
  })
)

export default router

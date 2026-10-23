import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { deriveKek, encryptKey, generateMasterKey, generateSalt } from '../src/utils/crypto'
import { ROLES } from '../src/config'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  const firstName = process.env.ADMIN_FIRSTNAME ?? 'Admin'
  const lastName = process.env.ADMIN_LASTNAME ?? ''
  if (!email || !password) throw new Error('ADMIN_EMAIL et ADMIN_PASSWORD requis')

  // Rôles
  const roles: Record<string, number> = {}
  for (const role of Object.values(ROLES)) {
    roles[role] = (
      await prisma.roles.upsert({ where: { role }, update: {}, create: { role } })
    ).role_id
  }

  // Admin initial (idempotent)
  const existing = await prisma.users.findFirst({ where: { email, is_email_verified: true } })
  if (existing) {
    console.log('[seed] Admin déjà présent, rien à faire.')
    return
  }

  // Clé maître générée ici (le mot de passe est dans l'env), même format que le client
  const masterKey = generateMasterKey()
  const kek_salt = generateSalt()
  const kek = await deriveKek(password, Buffer.from(kek_salt, 'hex'))

  const admin = await prisma.users.create({
    data: {
      email,
      firstName,
      lastName,
      password_hash: await bcrypt.hash(password, 12),
      is_active: true,
      is_email_verified: true,
      encrypted_master_key: encryptKey(masterKey, kek),
      kek_salt,
      userRoles: { create: { role_id: roles[ROLES.ADMIN] } },
    },
  })
  console.log(`[seed] Admin créé : ${admin.email}`)
}

main()
  .catch((e) => {
    console.error('[seed] Erreur :', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

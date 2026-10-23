import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Supprime tous les utilisateurs (cascade : sessions, tokens, rôles, accès modules)
async function main() {
  await prisma.users.deleteMany()
  console.log('[reset] Tous les utilisateurs supprimés.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

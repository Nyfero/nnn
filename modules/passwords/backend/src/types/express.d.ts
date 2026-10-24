import type { CoreUser } from '@myprout/sdk/server'

declare global {
  namespace Express {
    interface Request {
      user?: CoreUser
    }
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: { user_id: number; email: string; isAdmin: boolean; sid: number }
      moduleId?: string
    }
  }
}
export {}

// Admin : tous les serveurs. Utilisateur : ceux pour lesquels l'admin lui a donné la permission.
export const visibleTo = (user: { user_id: number; isAdmin: boolean }) =>
  user.isAdmin ? {} : { permissions: { some: { user_id: user.user_id } } }

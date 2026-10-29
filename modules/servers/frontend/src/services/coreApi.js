import { createApi } from '@myprout/sdk/client'

// API du core (liste des utilisateurs pour l'admin) : même session, même refresh automatique
export default createApi({ baseURL: '/api/core' })

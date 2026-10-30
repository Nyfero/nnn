import { createApi } from '@myprout/sdk/client'

// API du core (liste des utilisateurs pour l'administration des quotas) : même jeton
export default createApi({ baseURL: '/api/core' })

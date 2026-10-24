import { createApi } from '@myprout/sdk/client'

// Branché sur le store dans main.js (évite les imports circulaires)
export default createApi({ baseURL: '/api/core' })

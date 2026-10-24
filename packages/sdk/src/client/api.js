import axios from 'axios'

const REFRESH_URL = '/api/core/auth/refresh'

// Un seul refresh à la fois (plusieurs requêtes 401 simultanées partagent la promesse)
let refreshing = null

export function refreshSession() {
  refreshing ??= axios
    .post(REFRESH_URL, {}, { withCredentials: true })
    .then((res) => res.data)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// Instance axios pour le core ou un module. L'app branche son état via api.configure().
//   getToken()        -> access token courant
//   setSession(data)  -> appelé après un refresh réussi ({ token, user })
//   onAuthFailure()   -> session irrécupérable (redirection vers le login)
export function createApi({ baseURL = '/api/core' } = {}) {
  const hooks = {
    getToken: () => null,
    setSession: () => {},
    onAuthFailure: () => {},
  }

  const api = axios.create({ baseURL, withCredentials: true })
  api.configure = (h) => Object.assign(hooks, h)

  api.interceptors.request.use((config) => {
    const token = hooks.getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const { config, response } = error
      // On ne rafraîchit que si le token est en cause (pas pour un mauvais mot de passe)
      if (
        response?.status === 401 &&
        response.data?.code === 'TOKEN_INVALID' &&
        config &&
        !config._retry
      ) {
        config._retry = true
        try {
          const data = await refreshSession()
          hooks.setSession(data)
          config.headers.Authorization = `Bearer ${data.token}`
          return api(config)
        } catch {
          await hooks.onAuthFailure()
        }
      }
      return Promise.reject(error)
    }
  )

  return api
}

// Déconnexion après inactivité (à lancer dans le core et dans chaque module)
export function createInactivityGuard({ timeout = 20 * 60 * 1000, onTimeout }) {
  let timer = null
  const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(onTimeout, timeout)
  }

  return {
    start() {
      events.forEach((e) =>
        window.addEventListener(e, reset, { passive: true })
      )
      reset()
    },
    stop() {
      events.forEach((e) => window.removeEventListener(e, reset))
      clearTimeout(timer)
    },
  }
}

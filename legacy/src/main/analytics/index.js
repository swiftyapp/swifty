import ua from 'universal-analytics'
const client = ua(CONFIG.analytics)

const trackEvent = (category, action, label, value) => {
  if (CONFIG.analytics) client.event(category, action, label, value).send()
}

export const trackAppEvent = (event, label = null, value = null) => {
  trackEvent('Application', event, label, value)
}

export const trackVaultEvent = (event, label = null, value = null) => {
  trackEvent('Vault', event, label, value)
}

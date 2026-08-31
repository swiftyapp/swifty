const KEY = 'swifty:breachCheck'

// Off by default: the HIBP breach check makes an outbound request, so it stays
// opt-in until the user explicitly enables it.
export const getBreachCheck = (): boolean =>
  localStorage.getItem(KEY) === 'true'

export const setBreachCheck = (on: boolean) =>
  localStorage.setItem(KEY, String(on))

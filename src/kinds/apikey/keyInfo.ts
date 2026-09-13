// What the read view makes of a key without knowing who issued it.

// The issuer's prefix — `sk_live_`, `ghp_`, `cpl_live_`, `sk-proj-`: one or
// more short lower-case words, each closed by `_` or `-`. It names the issuer
// and the tier, not the secret, so the face prints it in plain sight and hides
// only what follows. Lower-case only, and a word has to start with a letter:
// issuers stamp their prefixes that way, and a run of random characters that
// happens to hold a dash rarely does. `xoxb-123-` is a prefix and then digits
// of the key, not two prefixes.
const PREFIX = /^(?:[a-z][a-z0-9]{0,11}[_-])+/

// What has to remain hidden for a prefix to be shown at all. Issued keys carry
// far more than this after the prefix; a shorter remainder means the "prefix"
// is more likely a slice of the secret itself, and the whole key stays masked.
const MIN_BODY = 16

export interface KeyParts {
  prefix: string
  body: string
}

export const splitKey = (key: string): KeyParts => {
  const match = PREFIX.exec(key)
  const prefix = match && key.length - match[0].length >= MIN_BODY ? match[0] : ''
  return { prefix, body: key.slice(prefix.length) }
}

// Scopes as they were typed — `read:user repo`, `read, write`, one per line —
// are all the same list.
export const scopesOf = (text: string): string[] => text.split(/[\s,]+/).filter(Boolean)

// `api.coupler.io/v1` from `https://api.coupler.io/v1/`: the address the way an
// API's docs print it, without the scheme the opener needs or a trailing slash.
// Something that is not a URL is shown as it is, less any scheme.
export const hostPath = (url: string): string => {
  try {
    const { host, pathname } = new URL(url)
    return `${host}${pathname.replace(/\/$/, '')}`
  } catch {
    return url.replace(/^[a-z][a-z\d+.-]*:\/\//i, '').replace(/\/$/, '')
  }
}

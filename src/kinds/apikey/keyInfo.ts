// What the read view makes of a key without knowing who issued it.

// Issuer prefixes the face may print in plain sight — each one documented by
// its issuer as the public stamp on every key of that tier, so showing it gives
// away nothing the issuer does not. Nothing is guessed from punctuation: a key
// whose front is not on this list is masked whole, since `deadbeef-` on an
// unknown format may well be eight characters of the secret. Longest first, so
// `sk-proj-` wins over `sk-` and `sk_live_` never leaves `abcd_` exposed.
const ISSUER_PREFIXES = [
  // Stripe
  'sk_live_',
  'sk_test_',
  'pk_live_',
  'pk_test_',
  'rk_live_',
  'rk_test_',
  'whsec_',
  // GitHub
  'github_pat_',
  'ghp_',
  'gho_',
  'ghu_',
  'ghs_',
  'ghr_',
  // GitLab
  'glpat-',
  'glptt-',
  'gldt-',
  // Slack
  'xoxb-',
  'xoxp-',
  'xoxa-',
  'xoxr-',
  'xapp-',
  // OpenAI, Anthropic
  'sk-proj-',
  'sk-svcacct-',
  'sk-admin-',
  'sk-ant-',
  // Package registries
  'npm_',
  'pypi-',
  // Hugging Face
  'hf_',
  // DigitalOcean
  'dop_v1_',
  'doo_v1_',
  // Shopify
  'shpat_',
  'shpca_',
  'shppa_',
  // SendGrid
  'SG.',
  // Google API keys
  'AIza',
  // Linear, Notion, Figma, Supabase, Postman
  'lin_api_',
  'ntn_',
  'figd_',
  'sbp_',
  'PMAK-'
].sort((a, b) => b.length - a.length)

export interface KeyParts {
  prefix: string
  body: string
}

export const splitKey = (key: string): KeyParts => {
  // A key that is only a prefix has nothing left to hide, so it has no prefix.
  const prefix = ISSUER_PREFIXES.find(known => key.startsWith(known) && key.length > known.length)
  return prefix ? { prefix, body: key.slice(prefix.length) } : { prefix: '', body: key }
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

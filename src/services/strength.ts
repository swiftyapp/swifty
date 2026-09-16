import type { TFunction } from 'i18next'

// Minimum master-password length. Length is the single biggest strength lever,
// so we gate on it directly rather than on composition rules.
export const MIN_LENGTH = 12

// Below this zxcvbn score a passphrase is trivially guessable; block it.
const MIN_SCORE = 2

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  warning: string
  suggestions: string[]
  tooShort: boolean
  acceptable: boolean
}

// One promise for the process: the first caller pays for the chunk, everyone
// after gets the already-resolved module. A failed load is forgotten rather
// than kept, so the next caller asks again instead of inheriting the rejection
// for the rest of the session.
let engine: Promise<typeof import('./strengthEngine')> | null = null

const load = () =>
  (engine ??= import('./strengthEngine').catch((error: unknown) => {
    engine = null
    throw error
  }))

export const evaluate = async (password: string): Promise<Strength> => {
  const { zxcvbn } = await load()
  const { score, feedback } = zxcvbn.check(password)
  const tooShort = password.length < MIN_LENGTH
  return {
    score,
    warning: feedback.warning ?? '',
    suggestions: feedback.suggestions,
    tooShort,
    acceptable: !tooShort && score >= MIN_SCORE
  }
}

/**
 * Why a chosen master password cannot be used, as the message to show — `null`
 * when it can. Every place that creates a vault (the first run, a new
 * workspace) asks this, so the bar is the same wherever a password is set
 * rather than typed. Async because the dictionaries are fetched on first use.
 */
export const masterPasswordError = async (
  password: string,
  t: TFunction
): Promise<string | null> => {
  if (!password) return t('Fill in the password')
  const { tooShort, acceptable } = await evaluate(password)
  if (tooShort) return t('Use at least {{count}} characters', { count: MIN_LENGTH })
  if (!acceptable) return t('Choose a stronger master password')
  return null
}

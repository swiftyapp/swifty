import type { TFunction } from 'i18next'
import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import * as common from '@zxcvbn-ts/language-common'
import * as en from '@zxcvbn-ts/language-en'

// Minimum master-password length. Length is the single biggest strength lever,
// so we gate on it directly rather than on composition rules.
export const MIN_LENGTH = 12

// Below this zxcvbn score a passphrase is trivially guessable; block it.
const MIN_SCORE = 2

const zxcvbn = new ZxcvbnFactory({
  dictionary: { ...common.dictionary, ...en.dictionary },
  graphs: common.adjacencyGraphs,
  translations: en.translations
})

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4
  warning: string
  suggestions: string[]
  tooShort: boolean
  acceptable: boolean
}

export const evaluate = (password: string): Strength => {
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
 * rather than typed.
 */
export const masterPasswordError = (password: string, t: TFunction): string | null => {
  if (!password) return t('Fill in the password')
  const { tooShort, acceptable } = evaluate(password)
  if (tooShort) return t('Use at least {{count}} characters', { count: MIN_LENGTH })
  if (!acceptable) return t('Choose a stronger master password')
  return null
}

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

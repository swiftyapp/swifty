import { ZxcvbnFactory } from '@zxcvbn-ts/core'
import * as common from '@zxcvbn-ts/language-common'
import * as en from '@zxcvbn-ts/language-en'

// The dictionaries are ~950 KB — nearly half the bundle — and are only needed
// when a master password is being set or changed. They live here alone so the
// whole lot lands in its own chunk, loaded on demand by `services/strength`.
export const zxcvbn = new ZxcvbnFactory({
  dictionary: { ...common.dictionary, ...en.dictionary },
  graphs: common.adjacencyGraphs,
  translations: en.translations
})

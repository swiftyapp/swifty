import 'i18next'
import type enUS from './locales/en-US.json'

/**
 * Makes en-US the schema for every key. `t('Sve')` is now a compile error
 * rather than a string that silently renders as `Sve`, and label data typed
 * as `TKey` is checked the same way — the class of bug that let `Expires`
 * ship without a catalog entry.
 */
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: { translation: typeof enUS }
    keySeparator: false
    nsSeparator: false
    returnNull: false
  }
}

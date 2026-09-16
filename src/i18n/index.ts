import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { APP_NAME } from '@/lib/app'
import enUS from './locales/en-US.json'

/** Native names, never translated — a language picker reads in its own language. */
export const LANGUAGES: Record<string, string> = {
  'en-US': 'English',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'pl-PL': 'Polski',
  'pt-BR': 'Português',
  'ru-RU': 'Русский',
  'sv-SE': 'Svenska',
  'tr-TR': 'Türkçe',
  'uk-UA': 'Українська',
  'zh-CN': '中文'
}

export const DEFAULT_LOCALE = 'en-US'
const SUPPORTED = Object.keys(LANGUAGES)

/**
 * Every key the catalog defines. Label data that gets handed to `t()` later
 * (kind metadata, settings sections, import tiles) is typed as this, so a key
 * with no catalog entry fails the build instead of rendering in English.
 */
export type TKey = keyof typeof enUS

/**
 * Keys are the English source strings, so both separators have to be off:
 * `keySeparator` would split `You're up to date.` and `nsSeparator` would split
 * `base32 secret or otpauth:// link`.
 */
// Every catalogue except en-US, each its own lazily-fetched chunk. en-US is
// excluded because it ships in the main bundle: it is the fallback, so it has
// to be there before anything renders.
const catalogues = import.meta.glob<Record<string, string>>(
  ['./locales/*.json', '!./locales/en-US.json'],
  { import: 'default' }
)

/**
 * Start i18next in `lng`. The caller decides what that is — `boot.ts` takes it
 * from the payload Rust injects before the bundle runs — so the catalogue is
 * loaded before the first paint and nothing here has to ask the backend
 * anything.
 *
 * A second call switches language instead: i18next drops `lng` when it is
 * already running, and silently staying in the first call's language is the
 * kind of bug that only shows up in a translated build.
 */
export const initI18n = (lng: string) =>
  (i18n.isInitialized
    ? i18n.changeLanguage(lng)
    : i18n
        .use(
          resourcesToBackend((language: string) =>
            catalogues[`./locales/${language}.json`]?.() ?? Promise.resolve({})
          )
        )
        .use(initReactI18next)
        .init({
          lng,
          resources: { [DEFAULT_LOCALE]: { translation: enUS } },
          partialBundledLanguages: true,
          fallbackLng: DEFAULT_LOCALE,
          supportedLngs: SUPPORTED,
          load: 'currentOnly',
          keySeparator: false,
          nsSeparator: false,
          returnNull: false,
          interpolation: {
            // React escapes for us; double-escaping would render raw entities.
            escapeValue: false,
            // No locale file spells the app name. Values interpolate
            // `{{appName}}` and every call site gets it for free, so a rename
            // stays one constant. Keys stay plain English, so a locale missing
            // the key still renders what the caller passed.
            defaultVariables: { appName: APP_NAME }
          }
        })
  ).then(translate => {
    // The listener below covers every later change; this covers the first
    // paint, which it does not fire for.
    document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LOCALE
    return translate
  })

// Tell the document what language it is in. Registered once, rather than
// wrapping `changeLanguage`, so a change from anywhere is picked up. Persisting
// the choice is the store's half of the same event (see `settingsSlice`), which
// keeps this module free of everything behind the store — it is what the api
// layer and a handful of leaf helpers reach for when they need a string.
//
// `lang` is not decoration: the micro labels are uppercased by CSS
// (`text-transform`, see LABEL_TYPE), and casing is language-dependent. Under
// `lang="en"` Turkish "i" uppercases to "I" instead of "İ", so every micro label
// in the Turkish UI is misspelled. It also drives screen-reader pronunciation
// and line breaking.
i18n.on('languageChanged', locale => {
  document.documentElement.lang = locale
})

export const getLocale = () => i18n.resolvedLanguage ?? DEFAULT_LOCALE

export const changeLocale = (locale: string) => i18n.changeLanguage(locale)

/**
 * For the handful of non-React modules that need a string outside a component
 * (`utils/time`, `services/openLink`, field validators, the kind registry).
 * Components use `useTranslation()` instead — only the hook re-renders.
 */
export const t = i18n.t.bind(i18n)

export default i18n

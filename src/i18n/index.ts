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
const STORAGE_KEY = 'rowel:locale'
// The unprefixed key this preference used to live under, before it joined the
// rest of them under `rowel:`. Read once, then retired.
const LEGACY_STORAGE_KEY = 'locale'

/**
 * Every key the catalog defines. Label data that gets handed to `t()` later
 * (kind metadata, settings sections, import tiles) is typed as this, so a key
 * with no catalog entry fails the build instead of rendering in English.
 */
export type TKey = keyof typeof enUS

const supported = (locale: string | null | undefined): locale is string =>
  !!locale && SUPPORTED.includes(locale)

/** The user's stored choice, migrating it off the old unprefixed key once. */
const storedLocale = (): string | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return stored

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!supported(legacy)) return null
    localStorage.setItem(STORAGE_KEY, legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return legacy
  } catch {
    // A locked-down webview can throw on storage; fall through to the OS.
    return null
  }
}

/**
 * An explicit choice wins; otherwise the OS locale Rust injected into the page
 * before the first script ran (see `window.rs`), which is why this is
 * synchronous and nothing is gated on IPC. Reading `navigator.language` instead
 * would report the embedded engine's configuration, which disagrees with the OS
 * on some Linux and Windows setups. Neither available: en-US.
 */
export const resolveInitial = (): string => {
  const stored = storedLocale()
  if (supported(stored)) return stored

  const system = window.__ROWEL_LOCALE__
  return supported(system) ? system : DEFAULT_LOCALE
}

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

export const i18nReady = i18n
  .use(
    resourcesToBackend((language: string) =>
      catalogues[`./locales/${language}.json`]?.() ?? Promise.resolve({})
    )
  )
  .use(initReactI18next)
  .init({
    lng: resolveInitial(),
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
      // No locale file spells the app name. Values interpolate `{{appName}}`
      // and every call site gets it for free, so a rename stays one constant.
      // Keys stay plain English, so a locale missing the key still renders
      // what the caller passed.
      defaultVariables: { appName: APP_NAME }
    }
  })
  .then(translate => {
    // The listener below covers every later change; this covers the first
    // paint, which it does not fire for.
    document.documentElement.lang = i18n.resolvedLanguage ?? DEFAULT_LOCALE
    return translate
  })

// Tell the document what language it is in. Registered once, rather than
// wrapping `changeLanguage`, so a change from anywhere is picked up. Nothing is
// persisted here: `init` emits this too, which would store the OS locale as if
// the user had picked it and stop the OS ever being consulted again.
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

/**
 * The one place a locale is persisted: reaching here means a person chose this
 * language, which is what outranks the OS on the next launch.
 */
export const changeLocale = (locale: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // A locked-down webview can throw on storage; the language still applies,
    // it just will not survive a restart.
  }
  return i18n.changeLanguage(locale)
}

/**
 * For the handful of non-React modules that need a string outside a component
 * (`utils/time`, `services/openLink`, field validators, the kind registry).
 * Components use `useTranslation()` instead — only the hook re-renders.
 */
export const t = i18n.t.bind(i18n)

export default i18n

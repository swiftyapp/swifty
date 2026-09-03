import enUS from './locales/en-US.json'
import deDE from './locales/de-DE.json'
import frFR from './locales/fr-FR.json'
import plPL from './locales/pl-PL.json'
import ptBR from './locales/pt-BR.json'
import ruRU from './locales/ru-RU.json'
import svSE from './locales/sv-SE.json'
import trTR from './locales/tr-TR.json'
import ukUA from './locales/uk-UA.json'
import zhCN from './locales/zh-CN.json'

type Translations = Record<string, string>

const translations: Record<string, Translations> = {
  'en-US': enUS,
  'de-DE': deDE,
  'fr-FR': frFR,
  'pl-PL': plPL,
  'pt-BR': ptBR,
  'ru-RU': ruRU,
  'sv-SE': svSE,
  'tr-TR': trTR,
  'uk-UA': ukUA,
  'zh-CN': zhCN
}

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

const DEFAULT_LOCALE = 'en-US'

let locale = localStorage.getItem('locale') || DEFAULT_LOCALE

export const getLocale = () => locale

export const setLocale = (next: string) => {
  locale = next
  localStorage.setItem('locale', next)
}

// Returns the translation for the key, falling back to the key itself.
export const t = (key: string): string =>
  translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? key

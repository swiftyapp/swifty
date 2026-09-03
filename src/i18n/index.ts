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
import { APP_NAME } from '@/lib/app'

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

// Values may name the app as `%{appName}` so no locale file hardcodes it.
// Keys never carry the placeholder: they stay plain English, which is what
// callers pass and what the fallback below renders.
const VARIABLES: Record<string, string> = { appName: APP_NAME }

const interpolate = (value: string): string =>
  value.replace(/%\{(\w+)\}/g, (match, name: string) => VARIABLES[name] ?? match)

// Returns the translation for the key, falling back to the key itself.
export const t = (key: string): string =>
  interpolate(translations[locale]?.[key] ?? translations[DEFAULT_LOCALE][key] ?? key)

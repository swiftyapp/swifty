import path from 'path'
import fs from 'fs-extra'
import { app } from 'electron'

let translations = {}
const AVAILABLE_LOCALES = [
  'en-US',
  'ru-RU',
  'tr-TR',
  'zh-CN',
  'pt-BR',
  'sv-SE',
  'fr-FR',
  'de-DE',
  'uk-UA',
  'pl-PL'
]
const DEFAULT_LOCALE = 'en-US'

function I18n() {
  const localesPath = path.join(app.getAppPath(), 'main', 'locales')

  AVAILABLE_LOCALES.forEach(locale => {
    translations[locale] = fs.readJSONSync(
      path.join(localesPath, locale + '.json')
    )
  })

  return {
    availableLocales: AVAILABLE_LOCALES,
    locale: DEFAULT_LOCALE,
    translations: translations
  }
}

const i18n = new I18n()

export { i18n }

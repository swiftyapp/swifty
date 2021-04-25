import path from 'path'
import fs from 'fs-extra'
import { app } from 'electron'

let loadedLanguage

function I18n() {
  const locale = app.getLocale().split('-')[0]
  const localesPath = path.join(app.getAppPath(), 'main', 'locales')
  const localeFile = path.join(localesPath, locale + '.json')
  const defaultLocaleFile = path.join(localesPath, 'en.json')

  loadedLanguage = fs.existsSync(localeFile)
    ? fs.readJSONSync(localeFile)
    : fs.readJSONSync(defaultLocaleFile)
}

I18n.prototype.data = () => loadedLanguage

I18n.prototype._ = phrase => loadedLanguage[phrase] || phrase

const i18n = new I18n()

export { i18n }

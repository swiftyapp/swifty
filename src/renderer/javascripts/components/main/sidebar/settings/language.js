import React from 'react'

const Language = ({ section }) => {
  const { i18n } = window
  if (section !== 'language') return null

  const languages = {
    'en-US': 'English',
    'ru-RU': 'Russian',
    'tr-TR': 'Turkish',
    'zh-CN': 'Chinese'
  }

  const setLanguage = lang => {
    window.localStorage.setItem('locale', lang)
    window.refreshApplication()
  }

  return (
    <>
      <h1>{i18n('Language')}</h1>
      <div className="select">
        <select
          name="locale"
          onChange={({ target }) => setLanguage(target.value)}
        >
          {Object.keys(languages).map(key => (
            <option key={key} value={key}>
              {languages[key]}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

export default Language

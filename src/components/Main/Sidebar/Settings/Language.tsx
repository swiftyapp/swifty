import { useStore, localeChanged } from '@/store'
import { LANGUAGES, t } from '@/i18n'
import type { Section } from './Navigation'

interface Props {
  section: Section
}

export default function Language({ section }: Props) {
  const locale = useStore(state => state.i18n.locale)

  if (section !== 'language') return null

  return (
    <>
      <h1>{t('Language')}</h1>
      <div className="select">
        <select
          name="locale"
          value={locale}
          onChange={e => localeChanged(e.target.value)}
        >
          {Object.keys(LANGUAGES).map(key => (
            <option key={key} value={key}>
              {LANGUAGES[key]}
            </option>
          ))}
        </select>
      </div>
    </>
  )
}

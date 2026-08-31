import { useStore, localeChanged } from '@/store'
import { LANGUAGES, t } from '@/i18n'
import type { Section } from './Navigation'
import Select from '@/components/elements/Select'
import { H1 } from './ui'

interface Props {
  section: Section
}

export default function Language({ section }: Props) {
  const locale = useStore(state => state.i18n.locale)

  if (section !== 'language') return null

  return (
    <>
      <h1 className={H1}>{t('Language')}</h1>
      <Select
        name="locale"
        value={locale}
        onChange={e => localeChanged(e.target.value)}
        className="max-w-xs"
      >
        {Object.keys(LANGUAGES).map(key => (
          <option key={key} value={key}>
            {LANGUAGES[key]}
          </option>
        ))}
      </Select>
    </>
  )
}

import { useTranslation } from 'react-i18next'
import SearchBox from '@/components/elements/SearchBox'

// Narrows the table by key and band caption. A real file runs to forty or
// sixty variables and the list search only sees titles and tags. State is the
// caller's: it lives with the table and goes with it. The list search's
// surface at its desktop measure, so the two read as one control.
export default function Filter({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <SearchBox
      value={value}
      onChange={onChange}
      placeholder={t('Filter variables')}
      testid="env-filter"
      className="mb-3 h-8 gap-2.5 rounded-sm pl-3 pr-1.5"
    />
  )
}

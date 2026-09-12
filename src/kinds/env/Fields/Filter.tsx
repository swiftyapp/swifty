import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import { SearchGlyph } from '@/components/Main/icons'

// The list search's surface (ListColumn/Search.tsx), at the desktop measure.
// That component is bound to the store's list query, so the field itself
// cannot be reused; the treatment is repeated so the two read as one control.
const SURFACE = cx(
  'group relative mb-3 flex h-8 items-center gap-2.5 rounded-sm border bg-tile pl-3 pr-1.5 text-text3',
  'border-transparent [&:hover:not(:focus-within)]:bg-text/10',
  'focus-within:border-accent-line focus-within:bg-detail focus-within:ring-3 focus-within:ring-accent-soft',
  'transition-[border-color,background-color,box-shadow] duration-300'
)

// Narrows the table by key and band caption. A real file runs to forty or
// sixty variables and the list search only sees titles and tags. State is the
// caller's: it lives with the table and goes with it.
export default function Filter({
  value,
  onChange
}: {
  value: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()

  // Escape clears, then (already clear) lets go of the caret, like the search.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    if (value === '') event.currentTarget.blur()
    else onChange('')
  }

  return (
    <div className={SURFACE}>
      <SearchGlyph className="flex-none transition-colors duration-300 group-hover:text-text2 group-focus-within:text-accent" />
      <input
        type="search"
        data-testid="env-filter"
        placeholder={t('Filter variables')}
        value={value}
        autoComplete="off"
        spellCheck={false}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 border-0 bg-transparent text-base text-text caret-accent outline-none placeholder:text-text3 [&::-webkit-search-cancel-button]:hidden"
      />
    </div>
  )
}

import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchGlyph } from '@/components/Main/icons'

interface Props {
  value: string
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

// The menu's header once there are enough vaults to hunt through: a bare field
// ruled off from the rows, with the key that closes it.
export default function Search({ value, onChange, onKeyDown }: Props) {
  const { t } = useTranslation()
  return (
    <div className="flex h-[42px] flex-none items-center gap-2 border-b border-line px-3.5">
      <SearchGlyph className="flex-none text-text3" stroke={1.4} />
      <input
        type="text"
        data-testid="workspace-search"
        aria-label={t('Find a vault')}
        placeholder={t('Find a vault')}
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-text3"
      />
      <span aria-hidden className="flex-none font-mono text-xs text-text3 any-pointer-coarse:hidden">
        esc
      </span>
    </div>
  )
}

import type { KeyboardEvent } from 'react'
import { t } from '@/i18n'
import Kbd from '@/components/elements/Kbd'
import { SearchGlyph } from '../icons'

interface Props {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
}

// The palette's only focusable control: a borderless field on a hairline,
// flanked by the search glyph and an `esc` hint.
export default function Input({ value, onChange, onKeyDown }: Props) {
  return (
    <div className="flex items-center gap-[11px] px-4 py-3.5 shadow-[inset_0_-1px_0_var(--c-line)]">
      <SearchGlyph className="flex-none text-text3" />
      <input
        // The palette is mounted only while open, so this focuses on every open.
        autoFocus
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('Search or run a command')}
        aria-label={t('Search or run a command')}
        data-testid="command-palette-input"
        className="min-w-0 flex-1 border-0 bg-transparent text-lg text-text caret-accent outline-none placeholder:text-text3"
      />
      <Kbd>esc</Kbd>
    </div>
  )
}

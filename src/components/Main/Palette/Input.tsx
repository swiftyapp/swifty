import type { KeyboardEvent } from 'react'
import { t } from '@/i18n'
import Kbd from '@/components/elements/Kbd'
import { SearchGlyph } from '../icons'

interface Props {
  value: string
  onChange: (value: string) => void
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  // The listbox this field drives, and the row currently focused in it.
  listId: string
  activeId?: string
}

// The palette's only focusable control: a borderless field on a hairline,
// flanked by the search glyph and an `esc` hint. It is the combobox for the
// result list below it — focus never leaves this field, so the list is only
// reachable to a screen reader through these attributes.
export default function Input({ value, onChange, onKeyDown, listId, activeId }: Props) {
  return (
    <div className="flex items-center gap-[11px] px-4 py-3.5 shadow-[inset_0_-1px_0_var(--c-line)]">
      <SearchGlyph className="flex-none text-text3" />
      <input
        // The palette is mounted only while open, so this focuses on every open.
        autoFocus
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={activeId}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('Run a command')}
        aria-label={t('Run a command')}
        data-testid="command-palette-input"
        className="min-w-0 flex-1 border-0 bg-transparent text-lg text-text caret-accent outline-none placeholder:text-text3"
      />
      <Kbd>esc</Kbd>
    </div>
  )
}

import { useMemo, useState, type KeyboardEvent } from 'react'
import { closePalette } from '@/store'
import { t } from '@/i18n'
import Input from './Input'
import Section from './Section'
import EntryRow from './EntryRow'
import CommandRow from './CommandRow'
import { useResults, type Item } from './useResults'
import { copySecret, openEntry } from './actions'

// The palette itself. Mounted only while open, so the query, the focused row,
// and the input focus all reset on every ⌘K.
export default function Panel() {
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState(0)

  const groups = useResults(query)
  const items = useMemo(() => groups.flatMap(group => group.items), [groups])
  const indexes = useMemo(() => new Map(items.map((item, i) => [item.key, i])), [items])

  // Results shrink as the query narrows; clamp rather than reset so the focus
  // survives a backspace.
  const focused = Math.min(focus, Math.max(items.length - 1, 0))

  const move = (step: number) =>
    setFocus(items.length === 0 ? 0 : (focused + step + items.length) % items.length)

  // ⏎ takes the primary action, ⌘⏎ the secondary one (entries only).
  const run = (item: Item, secondary: boolean) => {
    if (item.kind === 'command') item.command.run()
    else if (secondary) copySecret(item.entry)
    else openEntry(item.entry)
    closePalette()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Escape':
        closePalette()
        break
      case 'ArrowDown':
        move(1)
        break
      case 'ArrowUp':
        move(-1)
        break
      case 'Enter':
        if (items[focused]) run(items[focused], e.metaKey || e.ctrlKey)
        break
      // Focus stays in the field: there is nothing else to tab to.
      case 'Tab':
        break
      default:
        return
    }
    e.preventDefault()
  }

  return (
    <div
      onClick={closePalette}
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--scrim)] pt-[92px] backdrop-blur-[4px] animate-fade"
    >
      <div
        data-testid="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('Search or run a command')}
        onClick={e => e.stopPropagation()}
        className="w-[620px] overflow-hidden rounded-xl border border-line2 bg-detail shadow-[var(--shadow)] animate-pop"
      >
        <Input value={query} onChange={setQuery} onKeyDown={onKeyDown} />

        <div
          role="listbox"
          // Clicking a row must not pull focus out of the input.
          onMouseDown={e => e.preventDefault()}
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {items.length === 0 && (
            <div className="px-2.5 py-6 text-center text-base text-text3">{t('No results')}</div>
          )}

          {groups.map((group, i) => (
            <div key={group.label}>
              <Section label={group.label} first={i === 0} />
              {group.items.map(item => {
                const index = indexes.get(item.key) ?? 0
                const props = {
                  focused: index === focused,
                  onHover: () => setFocus(index)
                }

                return item.kind === 'entry' ? (
                  <EntryRow
                    key={item.key}
                    entry={item.entry}
                    onOpen={() => run(item, false)}
                    {...props}
                  />
                ) : (
                  <CommandRow
                    key={item.key}
                    command={item.command}
                    onRun={() => run(item, false)}
                    {...props}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

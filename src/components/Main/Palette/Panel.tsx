import { useState, type KeyboardEvent } from 'react'
import { closePalette } from '@/store'
import { t } from '@/i18n'
import Input from './Input'
import CommandRow from './CommandRow'
import { useResults } from './useResults'

// The palette itself. Mounted only while open, so the query, the focused row,
// and the input focus all reset on every ⌘K.
export default function Panel() {
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState(0)

  const commands = useResults(query)

  // Results shrink as the query narrows; clamp rather than reset so the focus
  // survives a backspace.
  const focused = Math.min(focus, Math.max(commands.length - 1, 0))

  const move = (step: number) =>
    setFocus(commands.length === 0 ? 0 : (focused + step + commands.length) % commands.length)

  const run = (index: number) => {
    const command = commands[index]
    if (!command) return
    command.run()
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
        run(focused)
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
        aria-label={t('Run a command')}
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
          {commands.length === 0 && (
            <div className="px-2.5 py-6 text-center text-base text-text3">{t('No results')}</div>
          )}

          {commands.map((command, index) => (
            <CommandRow
              key={command.id}
              command={command}
              focused={index === focused}
              onRun={() => run(index)}
              onHover={() => setFocus(index)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntryType } from '@/lib/commands'
import { useStore, closeAddPicker, startEntry } from '@/store'
import { KINDS } from '@/kinds'
import Modal from '@/components/elements/Modal'
import KindTile from './KindTile'

const TITLE_ID = 'add-secret-title'

const COLUMNS = 2

// How far each arrow moves through the 2-column grid. `useRadioNav` is the 1-D
// radiogroup pattern (selection follows focus, one tab stop), which is the
// wrong contract here: these tiles are actions, so focus has to move without
// choosing a kind.
const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: COLUMNS,
  ArrowUp: -COLUMNS
}

// The "Add a secret" kind picker: the one place the app asks *what* you are
// saving. Mounted once from Main; renders nothing until `ui.addPicker`.
export default function AddSecret() {
  const { t } = useTranslation()
  const open = useStore(state => state.ui.addPicker)
  const grid = useRef<HTMLDivElement>(null)

  const tiles = () => Array.from(grid.current?.querySelectorAll('button') ?? [])

  // The picker exists to be answered from the keyboard, so the first choice is
  // focused the moment it opens.
  useEffect(() => {
    if (open) grid.current?.querySelector('button')?.focus()
  }, [open])

  if (!open) return null

  const pick = (type: EntryType) => {
    startEntry(type)
    closeAddPicker()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = tiles()
    if (buttons.length === 0) return

    // 1..n picks the nth kind outright — the fastest path through the modal.
    const digit = Number(event.key)
    if (digit >= 1 && digit <= buttons.length) {
      buttons[digit - 1].click()
      event.preventDefault()
      return
    }

    const step = STEP[event.key]
    if (step === undefined) return
    const from = Math.max(buttons.indexOf(document.activeElement as HTMLButtonElement), 0)
    buttons[(from + step + buttons.length) % buttons.length].focus()
    event.preventDefault()
  }

  return (
    <Modal
      onClose={closeAddPicker}
      className="w-[640px]"
      labelledBy={TITLE_ID}
      testid="add-secret-modal"
    >
      <div className="w-full p-7">
        <h2 id={TITLE_ID} className="text-lg font-semibold tracking-display">
          {t('Add a secret')}
        </h2>
        <p className="mt-1.5 text-base text-text2">
          {t('Everything is encrypted before it touches disk.')}
        </p>

        <div ref={grid} onKeyDown={onKeyDown} className="mt-6 grid grid-cols-2 gap-3">
          {KINDS.map(kind => (
            <KindTile key={kind.type} kind={kind} onSelect={() => pick(kind.type)} />
          ))}
        </div>
      </div>
    </Modal>
  )
}

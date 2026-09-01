import { useEffect, useState } from 'react'
import type { Entry, EntryType } from '@/lib/commands'
import { editEntry } from '@/store'
import { t } from '@/i18n'
import { useCopied } from '@/hooks/useCopied'
import Button from '@/components/elements/Button'
import IconButton from '@/components/elements/IconButton'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'
import { CheckGlyph, MoreGlyph, PencilGlyph, TrashGlyph } from '../../../icons'

interface Props {
  type: EntryType
  // The decrypted entry, or null while `revealEntry` is still in flight.
  revealed: Entry | null
  onDelete: () => void
}

// Each type's headline secret — the one value the header offers in a single
// press. Reads straight off the already-decrypted entry, so copying never
// touches a row's on-screen reveal state.
const secretOf = (entry: Entry): string => {
  switch (entry.type) {
    case 'login':
      return entry.password
    case 'card':
      return entry.number
    case 'note':
      return entry.note
  }
}

const PRIMARY_LABEL: Record<EntryType, string> = {
  login: 'Copy password',
  card: 'Copy number',
  note: 'Copy note'
}

// Enter is the detail pane's accelerator for the primary action, but only as a
// bare press outside any text field or open dialog — anywhere else the key
// belongs to whatever the user is typing in.
const isPlainEnter = (e: KeyboardEvent) =>
  e.key === 'Enter' &&
  !e.metaKey &&
  !e.ctrlKey &&
  !e.altKey &&
  !e.shiftKey &&
  !e.defaultPrevented

const inTextField = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest('input, textarea, select, [contenteditable="true"]')

const dialogOpen = () => !!document.querySelector('[role="dialog"], dialog[open]')

// The detail header's action cluster: Edit, an overflow menu and the per-type
// primary copy action.
export default function Actions({ type, revealed, onDelete }: Props) {
  const [menu, setMenu] = useState(false)
  const { copied, copy } = useCopied()
  const secret = revealed ? secretOf(revealed) : ''

  useEffect(() => {
    if (!secret) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlainEnter(e) || inTextField(e.target) || dialogOpen()) return
      e.preventDefault()
      copy(secret)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [secret, copy])

  const run = (action: () => void) => () => {
    setMenu(false)
    action()
  }

  return (
    <div className="flex flex-none items-center gap-1.5">
      <Button variant="pale" size="md" onClick={() => editEntry()}>
        {t('Edit')}
      </Button>

      <div className="relative">
        <IconButton
          title={t('More actions')}
          active={menu}
          onClick={() => setMenu(!menu)}
          className="border border-line2 hover:border-accent-line"
          testid="more-actions-button"
        >
          <MoreGlyph />
        </IconButton>
        {menu && (
          <Dropdown className="right-0 top-8" onBlur={() => setMenu(false)}>
            <DropdownItem onClick={run(editEntry)}>
              <PencilGlyph />
              {t('Edit')}
            </DropdownItem>
            <DropdownItem separated danger onClick={run(onDelete)}>
              <TrashGlyph />
              {t('Delete')}
            </DropdownItem>
          </Dropdown>
        )}
      </div>

      <Button
        size="md"
        kbd="⏎"
        disabled={!secret}
        onClick={() => copy(secret)}
        testid="primary-action-button"
      >
        {copied ? (
          <>
            <CheckGlyph />
            {t('Copied')}
          </>
        ) : (
          t(PRIMARY_LABEL[type])
        )}
      </Button>
    </div>
  )
}

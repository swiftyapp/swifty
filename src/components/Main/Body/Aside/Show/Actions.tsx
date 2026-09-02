import { useEffect, useState } from 'react'
import type { Entry, EntryType } from '@/lib/commands'
import { editEntry } from '@/store'
import { kindOf } from '@/kinds'
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
  // Two-press delete: the first press arms the row ("Delete entry?"), the
  // second executes. Closing or reopening the menu disarms.
  const [armDelete, setArmDelete] = useState(false)
  const { copied, copy } = useCopied()
  const kind = kindOf(type)
  // The kind's headline secret — the one value the header offers in a single
  // press. Read straight off the already-decrypted entry, so copying never
  // touches a row's on-screen reveal state.
  const secret = revealed ? kind.primarySecret(revealed) : ''

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
    setArmDelete(false)
    action()
  }

  const toggleMenu = () => {
    setMenu(!menu)
    setArmDelete(false)
  }

  return (
    <div className="flex flex-none items-center gap-1.5">
      <Button
        variant="pale"
        size="md"
        testid="edit-entry-button"
        onClick={() => editEntry()}
      >
        {t('Edit')}
      </Button>

      <div className="relative">
        <IconButton
          title={t('More actions')}
          active={menu}
          onClick={toggleMenu}
          className="border border-line2 hover:border-accent-line"
          testid="more-actions-button"
        >
          <MoreGlyph />
        </IconButton>
        {menu && (
          <Dropdown className="right-0 top-8" onBlur={toggleMenu}>
            <DropdownItem onClick={run(editEntry)}>
              <PencilGlyph />
              {t('Edit')}
            </DropdownItem>
            {/* Same element for both presses: arm, then confirm. */}
            <DropdownItem
              separated
              danger
              testid={armDelete ? 'delete-entry-confirm' : 'delete-entry-button'}
              onClick={armDelete ? run(onDelete) : () => setArmDelete(true)}
            >
              <TrashGlyph />
              {armDelete ? t('Delete entry?') : t('Delete')}
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
          t(kind.primaryActionLabel)
        )}
      </Button>
    </div>
  )
}

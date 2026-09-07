import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '@/components/elements/IconButton'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'
import { ArchiveGlyph, MoreGlyph, PencilGlyph } from '../../../icons'

interface Props {
  onDelete: () => void
  /**
   * Given, Edit is the menu's first item. The desktop keeps Edit as a button
   * beside the menu, so it leaves this out; the phone's nav row has one control
   * and folds Edit under it.
   */
  onEdit?: () => void
  /** The trigger's own dress — the phone's nav row wants a 44px target. */
  className?: string
  /** Placement of the panel against the trigger (see Dropdown). */
  menu?: string
}

// The overflow menu of a live entry: archiving it, and on the phone editing it
// too. Archiving is two-press by design — the first press arms the row
// ("Archive entry?"), the second executes; closing or reopening the menu
// disarms. Both shells mount this one menu, so the confirm dance is written
// once.
export default function MoreMenu({
  onDelete,
  onEdit,
  className = 'border border-line2 hover:border-accent-line',
  menu = 'right-0 top-8'
}: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [armed, setArmed] = useState(false)

  const toggle = () => {
    setOpen(!open)
    setArmed(false)
  }

  const confirm = () => {
    setOpen(false)
    setArmed(false)
    onDelete()
  }

  return (
    <div className="relative">
      <IconButton
        title={t('More actions')}
        active={open}
        expanded={open}
        onClick={toggle}
        className={className}
        testid="more-actions-button"
      >
        <MoreGlyph />
      </IconButton>
      {open && (
        <Dropdown className={menu} onBlur={toggle}>
          {onEdit && (
            <DropdownItem
              testid="edit-entry-button"
              onClick={() => {
                setOpen(false)
                onEdit()
              }}
            >
              <PencilGlyph />
              {t('Edit')}
            </DropdownItem>
          )}
          {/* Same element for both presses: arm, then confirm. A rule above it
              keeps the destructive item off the edit's heels. */}
          <DropdownItem
            danger
            separated={!!onEdit}
            testid={armed ? 'delete-entry-confirm' : 'delete-entry-button'}
            onClick={armed ? confirm : () => setArmed(true)}
          >
            <ArchiveGlyph />
            {armed ? t('Archive entry?') : t('Archive')}
          </DropdownItem>
        </Dropdown>
      )}
    </div>
  )
}

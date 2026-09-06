import { useState } from 'react'
import type { EntryMeta } from '@/lib/commands'
import { restoreEntry, purgeEntry } from '@/store'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import { ArchiveRestoreGlyph } from '../../../icons'

interface Props {
  entry: EntryMeta
  /**
   * Extra classes for both buttons. `Button`'s sizes are the desktop's two
   * control tiers; a shell that needs a third (the phone's 44px touch one) says
   * so here rather than by being asked which shell it is.
   */
  className?: string
}

// The read header's action cluster for a tombstone. There is no Edit and no
// copy: `reveal_entry` does not serve deleted rows, so an archived entry has
// nothing to show and nothing to change — only Restore or the last delete.
export default function Archived({ entry, className }: Props) {
  const { t } = useTranslation()
  const [armed, setArmed] = useState(false)

  return (
    <div className="flex flex-none items-center gap-1.5">
      <Button
        variant={armed ? 'danger' : 'pale'}
        size="md"
        className={className}
        testid={armed ? 'purge-entry-confirm' : 'purge-entry-button'}
        onClick={armed ? () => void purgeEntry(entry.id) : () => setArmed(true)}
      >
        {armed ? t('Delete forever?') : t('Delete permanently')}
      </Button>

      <Button
        size="md"
        className={className}
        testid="restore-entry-button"
        onClick={() => void restoreEntry(entry.id)}
      >
        <ArchiveRestoreGlyph />
        {t('Restore')}
      </Button>
    </div>
  )
}

import { useState } from 'react'
import type { EntryMeta } from '@/lib/commands'
import { restoreEntry, purgeEntry } from '@/store'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'

// The read header's action cluster for a tombstone. There is no Edit and no
// copy: `reveal_entry` does not serve deleted rows, so a trashed entry has
// nothing to show and nothing to change — only Restore or the last delete.
export default function Trashed({ entry }: { entry: EntryMeta }) {
  const [armed, setArmed] = useState(false)

  return (
    <div className="flex flex-none items-center gap-1.5">
      <Button
        variant={armed ? 'danger' : 'pale'}
        size="md"
        testid={armed ? 'purge-entry-confirm' : 'purge-entry-button'}
        onClick={armed ? () => void purgeEntry(entry.id) : () => setArmed(true)}
      >
        {armed ? t('Delete forever?') : t('Delete permanently')}
      </Button>

      <Button size="md" testid="restore-entry-button" onClick={() => void restoreEntry(entry.id)}>
        {t('Restore')}
      </Button>
    </div>
  )
}

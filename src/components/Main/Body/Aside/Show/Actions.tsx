import type { Entry, EntryMeta } from '@/lib/commands'
import { editEntry } from '@/store'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import { CheckGlyph } from '../../../icons'
import Archived from './Archived'
import MoreMenu from './MoreMenu'
import { usePrimaryAction } from './usePrimaryAction'

interface Props {
  entry: EntryMeta
  // The decrypted entry, or null while `revealEntry` is still in flight.
  revealed: Entry | null
  onDelete: () => void
}

// The detail header's action cluster: Edit, an overflow menu and the per-type
// primary copy action — or, for a tombstone, Restore and the last delete. The
// phone shell spreads the same three across its nav row and bottom button.
export default function Actions({ entry, revealed, onDelete }: Props) {
  const { t } = useTranslation()
  const { label, secret, copied, copy } = usePrimaryAction(entry, revealed)

  // A tombstone is read-only, so it swaps the whole cluster rather than greying
  // parts of it out: nothing here applies to a row that is already archived.
  if (entry.deletedAt) return <Archived entry={entry} />

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

      <MoreMenu onDelete={onDelete} />

      <Button size="md" kbd="⏎" disabled={!secret} onClick={copy} testid="primary-action-button">
        {copied ? (
          <>
            <CheckGlyph />
            {t('Copied')}
          </>
        ) : (
          t(label)
        )}
      </Button>
    </div>
  )
}

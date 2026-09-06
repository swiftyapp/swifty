import { useTranslation } from 'react-i18next'
import type { EntryMeta, EntryType } from '@/lib/commands'
import { setNoEntry } from '@/store'
import NavBar from '../NavBar'
import { useHeading } from './useHeading'

interface Props {
  entry?: EntryMeta
  type: EntryType
}

/**
 * The form screen's frame, held until the secrets are in hand — an editor
 * seeded from a reveal that has not landed would discard whatever is typed
 * meanwhile.
 *
 * It carries a working Cancel rather than being a bare box: a reveal that never
 * arrives (an offline vault, a backend that refuses) would otherwise leave the
 * screen with no way off it. Cancel drops the whole entry state, which is where
 * this screen was pushed from.
 *
 * On the way in from the read screen this never renders — that screen already
 * revealed the entry and `Compact/Entry` shares the one reveal between the two
 * faces. Only an edit asked for before the first reveal landed gets here.
 */
export default function Held({ entry, type }: Props) {
  const { t } = useTranslation()
  const heading = useHeading(type, entry)

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-rise bg-detail text-text">
      <NavBar
        title={heading}
        leading={
          <button
            type="button"
            data-testid="cancel-entry-button"
            onClick={setNoEntry}
            className="flex h-14 min-w-11 cursor-pointer items-center px-2 text-md text-accent"
          >
            {t('Cancel')}
          </button>
        }
      />
      <div className="min-h-0 flex-1" />
    </div>
  )
}

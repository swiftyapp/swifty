import { useState } from 'react'
import { deleteEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import { useRevealed } from '@/hooks/useRevealed'
import { useFavicon } from '@/hooks/useFavicon'
import CardBrandMark from '@/components/elements/CardBrandMark'
import { hasBrandMark } from '@/utils/cardBrand'
import { kindOf } from '@/kinds'
import { relativeTime } from '@/utils/time'
import { t } from '@/i18n'
import Details from './Details'
import Actions from './Actions'
import { MONO_LABEL } from '../ui'

interface Props {
  entry: EntryMeta
}

export default function Show({ entry }: Props) {
  const revealed = useRevealed(entry)
  const icon = useFavicon(entry.urlHost)
  const kind = kindOf(entry.type)
  const Glyph = kind.Glyph
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Confirmation is inline in the more-menu (two-press pattern, like the
  // editor sheet's discard guard) — no native confirm(), which sits outside
  // the design language and blocks the webview.
  const onDelete = () => {
    setDeleteError(null)
    deleteEntry(entry.id).catch(() =>
      setDeleteError(t('Could not delete. Please try again.'))
    )
  }

  // Timestamps are reference, not content. The kind is already the eyebrow
  // above the title, so the ledger it used to head had nothing left to say.
  const stamps = [
    `${t('Modified')} ${relativeTime(entry.updatedAt)}`,
    `${t('Created')} ${relativeTime(entry.createdAt)}`
  ].join(' · ')

  return (
    <div className="mx-auto w-full max-w-[860px]">

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 whitespace-nowrap ${MONO_LABEL}`}>
            <span className="text-text2">{t(kind.label)}</span>
            {entry.urlHost && (
              <>
                <span>/</span>
                <span>{entry.urlHost}</span>
              </>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            {/* Same identity tile as the list row, sized to the title line. */}
            <div className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-lg bg-tile text-text2">
              {icon ? (
                <img src={icon} alt="" className="h-full w-full object-cover" />
              ) : hasBrandMark(entry.cardBrand) ? (
                <CardBrandMark brand={entry.cardBrand} size={12} />
              ) : (
                <Glyph size={16} />
              )}
            </div>
            <h1 className="truncate text-2xl font-semibold tracking-display text-text">
              {entry.title}
            </h1>
          </div>
        </div>
        <Actions type={entry.type} revealed={revealed} onDelete={onDelete} />
      </div>

      {revealed && <Details entry={revealed} />}

      {/* One quiet line at the foot of the pane, where a three-cell ledger used
          to compete with the details it sat above. */}
      <div data-testid="entry-stamps" className={`mt-5 ${MONO_LABEL}`}>
        {stamps}
      </div>

      {deleteError && (
        <div className="mt-3 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
          {deleteError}
        </div>
      )}
    </div>
  )
}

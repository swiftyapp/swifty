import { useState } from 'react'
import { deleteEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import { useRevealed } from '@/hooks/useRevealed'
import { t } from '@/i18n'
import Details from './Details'
import Actions from './Actions'
import { MONO_LABEL } from '../ui'

interface Props {
  entry: EntryMeta
}

const KIND_LABEL: Record<EntryMeta['type'], string> = {
  login: 'Login',
  card: 'Card',
  note: 'Secure note'
}

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : '—'

export default function Show({ entry }: Props) {
  const revealed = useRevealed(entry)
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

  const ledger: { k: string; v: string }[] = [
    { k: t('Type'), v: t(KIND_LABEL[entry.type]) },
    { k: t('Last Modified'), v: formatDate(entry.updatedAt) },
    { k: t('Created'), v: formatDate(entry.createdAt) }
  ]

  return (
    <div className="mx-auto w-full max-w-[860px]">

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 whitespace-nowrap ${MONO_LABEL}`}>
            <span className="text-text2">{t(KIND_LABEL[entry.type])}</span>
            {entry.urlHost && (
              <>
                <span>/</span>
                <span>{entry.urlHost}</span>
              </>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-display text-text">
            {entry.title}
          </h1>
        </div>
        <Actions type={entry.type} revealed={revealed} onDelete={onDelete} />
      </div>

      {/* Reference metadata, not content — no card fill, xs mono values, tight
          padding, so the block recedes behind the title and details. */}
      <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-lg border border-line">
        {ledger.map((cell, i) => (
          <div
            key={cell.k}
            className={
              i < ledger.length - 1
                ? 'border-r border-line px-3.5 py-2'
                : 'px-3.5 py-2'
            }
          >
            <div className={MONO_LABEL}>{cell.k}</div>
            <div className="mt-1 truncate font-mono text-xs text-text2">
              {cell.v}
            </div>
          </div>
        ))}
      </div>

      {revealed && <Details entry={revealed} />}
      {deleteError && (
        <div className="mt-3 rounded-lg border border-bad/40 bg-bad/5 px-4 py-3 text-base text-bad">
          {deleteError}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { editEntry, deleteEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import { useRevealed } from '@/hooks/useRevealed'
import { t } from '@/i18n'
import Details from './Details'
import Button from '@/components/elements/Button'
import { IconButton, MONO_LABEL } from '../ui'
import { TrashGlyph } from '../../../icons'

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

  const onDelete = () => {
    if (window.confirm(t('Are you sure you want to delete this item?'))) {
      setDeleteError(null)
      deleteEntry(entry.id).catch(() =>
        setDeleteError(t('Could not delete. Please try again.'))
      )
    }
  }

  const ledger: { k: string; v: string }[] = [
    { k: t('Type'), v: t(KIND_LABEL[entry.type]) },
    { k: t('Last Modified'), v: formatDate(entry.updatedAt) },
    { k: t('Created'), v: formatDate(entry.createdAt) }
  ]

  return (
    <div className="mx-auto max-w-[860px]">
      <div
        className="copied-notification hidden fixed left-1/2 top-4 z-50 w-max -translate-x-1/2 rounded-full bg-text px-5 py-2 text-[13px] text-detail shadow-[var(--shadow)]"
      >
        {t('Copied to Clipboard')}
      </div>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 whitespace-nowrap ${MONO_LABEL} tracking-[0.14em]`}>
            <span className="text-text2">{t(KIND_LABEL[entry.type])}</span>
            {entry.urlHost && (
              <>
                <span>/</span>
                <span>{entry.urlHost}</span>
              </>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-text">
            {entry.title}
          </h1>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          <IconButton
            title={t('Delete')}
            onClick={onDelete}
            className="border border-line2 hover:border-accent-line hover:text-bad"
          >
            <TrashGlyph />
          </IconButton>
          <Button size="sm" onClick={() => editEntry()}>{t('Edit')}</Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-[image:var(--card)]">
        {ledger.map((cell, i) => (
          <div
            key={cell.k}
            className={i < ledger.length - 1 ? 'border-r border-line px-3.5 py-3' : 'px-3.5 py-3'}
          >
            <div className={MONO_LABEL}>{cell.k}</div>
            <div className="mt-1.5 truncate font-mono text-[12px] text-text2">
              {cell.v}
            </div>
          </div>
        ))}
      </div>

      {revealed && <Details entry={revealed} />}
      {deleteError && (
        <div className="mt-3 rounded-xl border border-bad/40 bg-bad/5 px-4 py-3 text-[13px] text-bad">
          {deleteError}
        </div>
      )}
    </div>
  )
}

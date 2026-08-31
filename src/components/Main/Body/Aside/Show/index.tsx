import { useState } from 'react'
import { editEntry, deleteEntry } from '@/store'
import type { EntryMeta } from '@/lib/commands'
import { useRevealed } from '@/hooks/useRevealed'
import { t } from '@/i18n'
import Details from './Details'
import Error from '@/components/elements/Error'
import Pencil from '@/assets/images/pencil.svg?react'
import Delete from '@/assets/images/delete.svg?react'

interface Props {
  entry: EntryMeta
}

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : ''

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

  return (
    <div className="aside shaded">
      <div className="copied-notification hidden">
        {t('Copied to Clipboard')}
      </div>
      <div className="entry-title">
        <h1>{entry.title}</h1>
        <Pencil width="16" height="16" onClick={() => editEntry()} className="action" />
        <Delete width="16" height="16" onClick={onDelete} className="action" />
      </div>
      {revealed && <Details entry={revealed} />}
      <Error error={deleteError} />
      <div className="entry-extra">
        <div className="item">
          <div className="label">{t('Last Modified')}</div>
          <div className="value">{formatDate(entry.updatedAt)}</div>
        </div>
        <div className="item">
          <div className="label">{t('Created')}</div>
          <div className="value">{formatDate(entry.createdAt)}</div>
        </div>
      </div>
    </div>
  )
}

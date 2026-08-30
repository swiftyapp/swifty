import { useAppDispatch } from '@/store'
import { editEntry } from '@/store/entriesSlice'
import { deleteEntry } from '@/store/thunks'
import type { Entry } from '@/lib/commands'
import { t } from '@/i18n'
import Details from './Details'
import Pencil from '@/assets/images/pencil.svg?react'
import Delete from '@/assets/images/delete.svg?react'

interface Props {
  entry: Entry
}

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleString() : ''

export default function Show({ entry }: Props) {
  const dispatch = useAppDispatch()

  const onDelete = () => {
    if (window.confirm(t('Are you sure you want to delete this item?'))) {
      dispatch(deleteEntry(entry.id))
    }
  }

  return (
    <div className="aside shaded">
      <div className="copied-notification hidden">
        {t('Copied to Clipboard')}
      </div>
      <div className="entry-title">
        <h1>{entry.title}</h1>
        <Pencil width="16" height="16" onClick={() => dispatch(editEntry())} className="action" />
        <Delete width="16" height="16" onClick={onDelete} className="action" />
      </div>
      <Details entry={entry} />
      <div className="entry-extra">
        <div className="item">
          <div className="label">{t('Last Modified')}</div>
          <div className="value">{formatDate(entry.updatedAt || entry.updated_at)}</div>
        </div>
        <div className="item">
          <div className="label">{t('Created')}</div>
          <div className="value">{formatDate(entry.createdAt || entry.created_at)}</div>
        </div>
      </div>
    </div>
  )
}

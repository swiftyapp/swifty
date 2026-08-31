import { useStore, newEntry, setFilterScope } from '@/store'
import { t } from '@/i18n'
import Tooltip from '@/components/elements/Tooltip'
import { PlusGlyph } from '../icons'

export default function Add() {
  const scope = useStore(state => state.filters.scope)

  const onAddEntry = () => {
    if (scope === 'audit') setFilterScope('login')
    newEntry()
  }

  return (
    <Tooltip content={t('New Secret')}>
      <div
        data-testid="add-entry-button"
        onClick={onAddEntry}
        className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-dashed border-accent-line text-accent transition-colors hover:bg-accent-soft"
      >
        <PlusGlyph />
      </div>
    </Tooltip>
  )
}

import { useState } from 'react'
import { cx } from '@/utils/cx'
import { useAppDispatch, useAppSelector } from '@/store'
import { newEntry } from '@/store/entriesSlice'
import { syncImport } from '@/lib/commands'
import { t } from '@/i18n'

export default function Actions() {
  const dispatch = useAppDispatch()
  const isPristine = useAppSelector(state => state.entries.items.length === 0)
  const [loading, setLoading] = useState(false)

  const onImport = () => {
    setLoading(true)
    syncImport()
  }

  if (!isPristine) return null

  return (
    <div className="actions">
      <div>
        <a href="#" onClick={() => dispatch(newEntry())}>
          {t('Create First Entry')}
        </a>
      </div>
      <div>{t('or')}</div>
      <div>
        <span className={cx('button', { loading })} onClick={onImport}>
          {t('Import from Gdrive')}
        </span>
      </div>
    </div>
  )
}

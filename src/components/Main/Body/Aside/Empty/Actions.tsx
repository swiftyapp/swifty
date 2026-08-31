import { useState } from 'react'
import { cx } from '@/utils/cx'
import { useStore, newEntry } from '@/store'
import { syncImport } from '@/lib/commands'
import { SYNC_ENABLED } from '@/config'
import { t } from '@/i18n'

export default function Actions() {
  const isPristine = useStore(state => state.entries.items.length === 0)
  const [loading, setLoading] = useState(false)

  const onImport = () => {
    setLoading(true)
    syncImport()
  }

  if (!isPristine) return null

  return (
    <div className="actions">
      <div>
        <a href="#" onClick={() => newEntry()}>
          {t('Create First Entry')}
        </a>
      </div>
      {SYNC_ENABLED && (
        <>
          <div>{t('or')}</div>
          <div>
            <span className={cx('button', { loading })} onClick={onImport}>
              {t('Import from Gdrive')}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

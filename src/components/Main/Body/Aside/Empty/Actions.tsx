import { useState } from 'react'
import { useStore, newEntry } from '@/store'
import { syncImport } from '@/lib/commands'
import { SYNC_ENABLED } from '@/config'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'

export default function Actions() {
  const isPristine = useStore(state => state.entries.items.length === 0)
  const [loading, setLoading] = useState(false)

  const onImport = () => {
    setLoading(true)
    syncImport()
  }

  if (!isPristine) return null

  return (
    <div className="mt-6 flex items-center gap-3">
      <Button onClick={() => newEntry()}>{t('Create First Entry')}</Button>
      {SYNC_ENABLED && (
        <>
          <span className="text-base text-text3">{t('or')}</span>
          <Button variant="pale" loading={loading} onClick={onImport}>
            {t('Import from Gdrive')}
          </Button>
        </>
      )}
    </div>
  )
}

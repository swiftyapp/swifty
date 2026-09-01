import { useState } from 'react'
import { useStore, newEntry } from '@/store'
import { syncImport } from '@/lib/commands'
import { t } from '@/i18n'
import Button from '@/components/elements/Button'

export default function Actions() {
  const isPristine = useStore(state => state.entries.items.length === 0)
  const [loading, setLoading] = useState(false)

  const onImport = () => {
    setLoading(true)
    // On success this screen is replaced by the imported entries; on failure
    // the button has to come back, or it spins forever.
    syncImport().catch(() => setLoading(false))
  }

  if (!isPristine) return null

  return (
    <div className="mt-6 flex items-center gap-3">
      <Button testid="create-first-entry-button" onClick={() => newEntry()}>
        {t('Create First Entry')}
      </Button>
      <span className="text-base text-text3">{t('or')}</span>
      <Button variant="pale" loading={loading} onClick={onImport}>
        {t('Import from Gdrive')}
      </Button>
    </div>
  )
}

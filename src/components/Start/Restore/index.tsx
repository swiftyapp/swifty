import { useState } from 'react'
import { t } from '@/i18n'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Import from './Import'
import Confirm from './Confirm'

interface Props {
  goBack: () => void
}

export default function Restore({ goBack }: Props) {
  const [path, setPath] = useState<string | null>(null)
  const chosen = path !== null

  return (
    <AuthShell meta={`${t('offline')} · aes-256-gcm`} onBack={goBack}>
      <Eyebrow tone="accent">{t('Restore')}</Eyebrow>
      <h1 className="mt-8 text-center text-2xl font-medium tracking-tight text-text">
        {t('Restore Backup')}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-text2">
        {chosen ? t('Enter the Master Password for this backup') : t('Restore Instructions')}
      </p>

      <div className="mt-9">
        <Import display={!chosen} onImport={setPath} />
        <Confirm display={chosen} path={path ?? ''} />
      </div>
    </AuthShell>
  )
}

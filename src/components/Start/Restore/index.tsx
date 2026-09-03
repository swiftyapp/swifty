import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Import from './Import'
import Confirm from './Confirm'

interface Props {
  goBack: () => void
}

export default function Restore({ goBack }: Props) {
  const { t } = useTranslation()
  const [path, setPath] = useState<string | null>(null)
  const chosen = path !== null

  return (
    <AuthShell onBack={goBack}>
      <Eyebrow>{t('Restore')}</Eyebrow>
      <h1 className="mt-8 text-center text-2xl font-medium tracking-display text-text">
        {t('Restore Backup')}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-base leading-relaxed text-text2">
        {chosen ? t('Enter the Master Password for this backup') : t('Restore Instructions')}
      </p>

      <div className="mt-9">
        <Import display={!chosen} onImport={setPath} />
        <Confirm display={chosen} path={path ?? ''} />
      </div>
    </AuthShell>
  )
}

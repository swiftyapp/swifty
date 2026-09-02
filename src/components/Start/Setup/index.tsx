import { useState } from 'react'
import { t } from '@/i18n'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Enter from './Enter'
import Confirm from './Confirm'

interface Props {
  goBack: () => void
}

export default function Setup({ goBack }: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const confirming = password !== null

  return (
    <AuthShell onBack={goBack}>
      <Eyebrow>{t('New vault')}</Eyebrow>
      <h1 className="mt-8 text-center text-2xl font-medium tracking-display text-text">
        {t('Account Setup')}
      </h1>
      <p className="mx-auto mt-3 max-w-md text-center text-base leading-relaxed text-text2">
        {confirming ? t('Confirm your Master Password') : t('Setup Instructions')}
      </p>

      <div className="mt-9">
        <Enter display={!confirming} onEnter={setPassword} />
        <Confirm display={confirming} password={password ?? ''} />
      </div>
    </AuthShell>
  )
}

import { t } from '@/i18n'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Button from '@/components/elements/Button'

interface Props {
  onSelect: (flow: 'setup' | 'restore') => void
}

export default function Choice({ onSelect }: Props) {
  return (
    <AuthShell meta={`${t('offline')} · aes-256-gcm`}>
      <Eyebrow>{t('Welcome to Swifty')}</Eyebrow>
      <h1 className="mt-8 text-center text-2xl font-medium tracking-tight text-text">
        {t('Set up your vault')}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-relaxed text-text2">
        {t('Create a new vault or restore from an existing backup.')}
      </p>
      <div className="mx-auto mt-9 flex w-72 max-w-full flex-col gap-3">
        <Button block testid="start-setup-button" onClick={() => onSelect('setup')}>
          {t('Setup Master Password')}
        </Button>
        <Button block variant="ghost" onClick={() => onSelect('restore')}>
          {t('Restore from Backup')}
        </Button>
      </div>
    </AuthShell>
  )
}

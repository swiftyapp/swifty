import { useTranslation } from 'react-i18next'
import AuthShell from '@/components/elements/AuthShell'
import Eyebrow from '@/components/elements/Eyebrow'
import Button from '@/components/elements/Button'

interface Props {
  onSelect: (flow: 'setup' | 'restore') => void
}

export default function Choice({ onSelect }: Props) {
  const { t } = useTranslation()
  return (
    <AuthShell>
      <Eyebrow>{t('Welcome')}</Eyebrow>
      <h1 className="mt-8 text-center text-2xl font-medium tracking-display text-text">
        {t('Set up your vault')}
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-center text-base leading-relaxed text-text2">
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

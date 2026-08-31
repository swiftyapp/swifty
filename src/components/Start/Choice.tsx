import { t } from '@/i18n'
import NewUser from '@/assets/images/new_user.svg?react'
import Backup from '@/assets/images/backup.svg?react'

interface Props {
  onSelect: (flow: 'setup' | 'restore') => void
}

export default function Choice({ onSelect }: Props) {
  return (
    <div className="lock-screen">
      <div className="top-lock">
        <NewUser width="48" />
        <h2>{t('I am a new User')}</h2>
        <div
          className="button"
          data-testid="start-setup-button"
          onClick={() => onSelect('setup')}
        >
          {t('Setup Master Password')}
        </div>
      </div>
      <div className="bottom-lock">
        <Backup width="48" />
        <h2>{t('I am existing User')}</h2>
        <div className="button" onClick={() => onSelect('restore')}>
          {t('Restore from Backup')}
        </div>
      </div>
    </div>
  )
}

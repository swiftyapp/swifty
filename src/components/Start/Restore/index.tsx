import { useState } from 'react'
import { t } from '@/i18n'
import Backup from '@/assets/images/backup.svg?react'
import Import from './Import'
import Confirm from './Confirm'

interface Props {
  goBack: () => void
}

export default function Restore({ goBack }: Props) {
  const [path, setPath] = useState<string | null>(null)

  return (
    <div className="lock-screen">
      <div className="top-lock">
        <Backup width="48" />
        <h2>{t('Restore Backup')}</h2>
        <div className="instructions">{t('Restore Instructions')}</div>
      </div>
      <div className="bottom-lock">
        <Import display={path === null} goBack={goBack} onImport={setPath} />
        <Confirm display={path !== null} path={path ?? ''} />
      </div>
    </div>
  )
}

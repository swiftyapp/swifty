import { t } from '@/i18n'
import Actions from './Actions'
import Security from '@/assets/images/security.svg?react'

export default function Empty() {
  return (
    <div className="aside">
      <div className="empty">
        <Security width={200} height={200} />
        <h2>Swifty</h2>
        <p>{t('Keep your passwords safe and organized')}</p>
        <Actions />
      </div>
    </div>
  )
}

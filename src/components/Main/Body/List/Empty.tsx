import { t } from '@/i18n'

export default function Empty() {
  return (
    <div className="list">
      <div className="empty">{t('No Items')}</div>
    </div>
  )
}

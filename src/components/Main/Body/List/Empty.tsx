import { t } from '@/i18n'

export default function Empty() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="font-mono text-xs uppercase tracking-label text-text3">
        {t('No Items')}
      </div>
    </div>
  )
}

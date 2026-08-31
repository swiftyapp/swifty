import { t } from '@/i18n'

export default function Empty() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-text3">
        {t('No Items')}
      </div>
    </div>
  )
}

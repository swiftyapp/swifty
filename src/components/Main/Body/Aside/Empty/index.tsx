import { t } from '@/i18n'
import Actions from './Actions'
import { ShieldGlyph } from '../../../icons'

export default function Empty() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-lg bg-accent-soft text-accent">
        <ShieldGlyph size={30} />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-display text-text">
        Swifty
      </h2>
      <p className="mt-2 max-w-[320px] text-base text-text2">
        {t('Keep your passwords safe and organized')}
      </p>
      <Actions />
    </div>
  )
}

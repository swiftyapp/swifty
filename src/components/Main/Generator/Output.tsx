import { useTranslation } from 'react-i18next'
import { cx } from '@/utils/cx'
import Meter from '@/components/elements/Meter'
import { LEVEL_INK } from '@/components/elements/levels'
import { ENTROPY_LABELS } from '@/services/generator'
import { wellClass } from '@/components/elements/formStyles'

interface Props {
  value: string
  bits: number
  level: number
}

// The generated secret on its field tile, with the entropy meter underneath.
export default function Output({ value, bits, level }: Props) {
  const { t } = useTranslation()
  return (
    <>
      <div
        data-testid="generator-output"
        className={`min-h-14 ${wellClass} p-4 font-mono text-lg leading-[1.55] break-all`}
      >
        {value}
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <Meter level={level} />
        <span className={cx('font-mono text-xs', LEVEL_INK[level])}>
          {t(ENTROPY_LABELS[level])} · {bits} {t('bits')}
        </span>
      </div>
    </>
  )
}

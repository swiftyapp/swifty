import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import type { GeneratorMode } from '@/services/generator'

const TABS: { mode: GeneratorMode; label: string }[] = [
  { mode: 'random', label: 'Random' },
  { mode: 'memorable', label: 'Memorable' }
]

interface Props {
  mode: GeneratorMode
  onChange: (mode: GeneratorMode) => void
}

// Segmented control in the dialog header: the active tab wears the accent wash.
export default function Tabs({ mode, onChange }: Props) {
  return (
    <div className="flex flex-none gap-0.5 rounded-sm border border-line2 p-0.5">
      {TABS.map(tab => (
        <button
          key={tab.mode}
          type="button"
          data-testid={`generator-mode-${tab.mode}`}
          onClick={() => onChange(tab.mode)}
          className={cx(
            'cursor-pointer rounded-sm px-2.5 py-[3px] text-base transition-colors',
            mode === tab.mode
              ? 'bg-accent-soft text-text'
              : 'text-text3 hover:text-text'
          )}
        >
          {t(tab.label)}
        </button>
      ))}
    </div>
  )
}

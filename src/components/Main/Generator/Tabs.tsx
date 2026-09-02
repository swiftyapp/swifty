import { t } from '@/i18n'
import Segmented from '@/components/elements/Segmented'
import type { GeneratorMode } from '@/services/generator'

const TABS: { value: GeneratorMode; label: string }[] = [
  { value: 'random', label: 'Random' },
  { value: 'memorable', label: 'Memorable' }
]

interface Props {
  mode: GeneratorMode
  onChange: (mode: GeneratorMode) => void
}

// Mode switch in the dialog header — the shared Segmented control.
export default function Tabs({ mode, onChange }: Props) {
  return (
    <Segmented
      options={TABS.map(tab => ({ value: tab.value, label: t(tab.label) }))}
      value={mode}
      onChange={onChange}
      testidPrefix="generator-mode"
      className="flex-none"
    />
  )
}

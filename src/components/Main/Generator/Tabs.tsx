import { useTranslation } from 'react-i18next'
import Segmented from '@/components/elements/Segmented'
import type { TKey } from '@/i18n'
import type { GeneratorMode } from '@/services/generator'

const TABS: { value: GeneratorMode; label: TKey }[] = [
  { value: 'random', label: 'Random' },
  { value: 'memorable', label: 'Memorable' }
]

interface Props {
  mode: GeneratorMode
  onChange: (mode: GeneratorMode) => void
}

// Mode switch in the dialog header — the shared Segmented control.
export default function Tabs({ mode, onChange }: Props) {
  const { t } = useTranslation()
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

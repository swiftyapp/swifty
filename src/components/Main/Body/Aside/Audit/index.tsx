import { useStore } from '@/store'
import type { Audit, AuditItem } from '@/lib/commands'
import { t } from '@/i18n'
import Score from './Score'
import { Panel, MONO_LABEL } from '../ui'

const count = (audit: Audit, property: keyof AuditItem) =>
  Object.values(audit).filter(item => item[property]).length

export default function Audit() {
  const audit = useStore(state => state.audit)
  const breachCheck = useStore(state => state.breachCheck)
  const isPristine = useStore(state => state.entries.items.length === 0)

  if (isPristine || !audit) return null

  const stats: { label: string; value: number; dot: string; show: boolean }[] = [
    { label: t('Weak'), value: count(audit, 'isWeak'), dot: 'bg-bad', show: true },
    { label: t('Reused'), value: count(audit, 'isRepeating'), dot: 'bg-warn', show: true },
    { label: t('Breached'), value: count(audit, 'breached'), dot: 'bg-bad', show: !!breachCheck }
  ]

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center py-4">
      <div className={MONO_LABEL}>{t('Password Audit')}</div>
      <div className="mt-6">
        <Score audit={audit} />
      </div>
      <Panel className="mt-8 w-full">
        {stats
          .filter(s => s.show)
          .map(s => (
            <div
              key={s.label}
              className="flex items-center gap-3 px-4 py-3 shadow-[inset_0_-1px_0_var(--c-line)] last:shadow-none"
            >
              <span className={`h-[7px] w-[7px] flex-none rounded-full ${s.dot}`} />
              <span className="flex-1 text-base text-text2">{s.label}</span>
              <span className="font-mono text-base text-text">{s.value}</span>
            </div>
          ))}
      </Panel>
    </div>
  )
}

import { useStore } from '@/store'
import type { Audit, AuditItem, EntryMeta } from '@/lib/commands'
import { t } from '@/i18n'
import Empty from '../Empty'
import Group from './Group'

export default function AuditList() {
  const audit = useStore(state => state.audit)
  const breachCheck = useStore(state => state.breachCheck)
  const items = useStore(state => state.entries.items)

  const byProperty = (property: keyof AuditItem): EntryMeta[] =>
    Object.keys(audit as Audit)
      .filter(id => (audit as Audit)[id][property])
      .map(id => items.find(entry => entry.id === id))
      .filter((entry): entry is EntryMeta => entry !== undefined)

  if (!audit)
    return (
      <div className="px-4 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-text3">
        {t('Loading Results..')}
      </div>
    )
  if (Object.keys(audit).length === 0) return <Empty />

  return (
    <div className="pb-6">
      <Group title="Weak" entries={byProperty('isWeak')} />
      <Group title="Reused" entries={byProperty('isRepeating')} />
      {breachCheck && <Group title="Breached" entries={byProperty('breached')} />}
    </div>
  )
}

import { useStore } from '@/store'
import type { Audit, AuditItem, Entry } from '@/lib/commands'
import { t } from '@/i18n'
import Empty from '../Empty'
import Group from './Group'

export default function AuditList() {
  const audit = useStore(state => state.audit)
  const breachCheck = useStore(state => state.breachCheck)
  const items = useStore(state => state.entries.items)

  const byProperty = (property: keyof AuditItem): Entry[] =>
    Object.keys(audit as Audit)
      .filter(id => (audit as Audit)[id][property])
      .map(id => items.find(entry => entry.id === id))
      .filter((entry): entry is Entry => entry !== undefined)

  if (!audit) return <div>{t('Loading Results..')}</div>
  if (Object.keys(audit).length === 0) return <Empty />

  return (
    <div className="list">
      <Group title="Weak" level="level-one" entries={byProperty('isWeak')} />
      <Group
        title="Reused"
        level="level-two"
        entries={byProperty('isRepeating')}
      />
      {breachCheck && (
        <Group
          title="Breached"
          level="level-three"
          entries={byProperty('breached')}
        />
      )}
    </div>
  )
}

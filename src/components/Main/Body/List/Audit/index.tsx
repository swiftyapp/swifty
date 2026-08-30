import { useAppSelector } from '@/store'
import type { Audit, AuditItem, Entry } from '@/lib/commands'
import { t } from '@/i18n'
import Empty from '../Empty'
import Group from './Group'

export default function AuditList() {
  const { items, audit } = useAppSelector(state => ({
    audit: state.audit,
    items: state.entries.items
  }))

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
      <Group title="Short" level="level-two" entries={byProperty('isShort')} />
      <Group
        title="Duplicates"
        level="level-three"
        entries={byProperty('isRepeating')}
      />
      <Group title="Old" level="level-four" entries={byProperty('isOld')} />
    </div>
  )
}

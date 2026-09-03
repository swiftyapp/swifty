import { useStore } from '@/store'
import type { AuditItem, EntryMeta } from '@/lib/commands'
import { useTranslation } from 'react-i18next'
import Group from '../Group'

export default function AuditList() {
  const { t } = useTranslation()
  const audit = useStore(state => state.audit)
  const breachCheck = useStore(state => state.breachCheck)
  const items = useStore(state => state.entries.items)

  if (!audit)
    return (
      <div className="px-4 py-6 font-mono text-xs uppercase tracking-label text-text3">
        {t('Loading Results..')}
      </div>
    )
  // Nothing to score: the detail pane says so on its own (Body/Empty), so the
  // column stays blank rather than repeating it.
  if (Object.keys(audit).length === 0) return null

  // Below the guard, so the audit is known to be there.
  const byProperty = (property: keyof AuditItem): EntryMeta[] =>
    Object.keys(audit)
      .filter(id => audit[id][property])
      .map(id => items.find(entry => entry.id === id))
      .filter((entry): entry is EntryMeta => entry !== undefined)

  return (
    <div className="pb-6">
      <Group title="Weak" entries={byProperty('isWeak')} />
      <Group title="Reused" entries={byProperty('isRepeating')} />
      {breachCheck && <Group title="Breached" entries={byProperty('breached')} />}
    </div>
  )
}

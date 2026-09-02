import type { Audit, AuditItem } from '@/lib/commands'

// A single entry's health, 0..1: strength, minus a penalty for reuse and a
// heavier one for a known breach.
const healthOf = (record: AuditItem) => {
  let value = record.score / 4
  if (record.isRepeating) value -= 0.25
  if (record.breached) value -= 0.5
  return Math.max(0, value)
}

// The whole vault as 0..100, or null when there is nothing to score.
export const vaultScore = (audit: Audit): number | null => {
  const records = Object.values(audit)
  if (records.length === 0) return null
  const health = records.reduce((total, record) => total + healthOf(record), 0)
  return Math.round((health / records.length) * 100)
}

export const auditCounts = (audit: Audit) => {
  const records = Object.values(audit)
  return {
    weak: records.filter(item => item.isWeak).length,
    reused: records.filter(item => item.isRepeating).length,
    breached: records.filter(item => item.breached).length
  }
}

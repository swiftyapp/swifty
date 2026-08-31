import { useStore } from '@/store'
import type { Audit, AuditItem } from '@/lib/commands'
import { t } from '@/i18n'
import Score from './Score'

const count = (audit: Audit, property: keyof AuditItem) =>
  Object.values(audit).filter(item => item[property]).length

export default function Audit() {
  const audit = useStore(state => state.audit)
  const breachCheck = useStore(state => state.breachCheck)
  const isPristine = useStore(state => state.entries.items.length === 0)

  if (isPristine || !audit) return null

  return (
    <div className="aside">
      <div className="audit">
        <Score audit={audit} />
        <h3>{t('Password Audit')}</h3>
        <ul className="stats">
          <li>
            <span className="marker level-one"></span>
            {t('Weak')} <span className="count">{count(audit, 'isWeak')}</span>
          </li>
          <li>
            <span className="marker level-two"></span>
            {t('Reused')}{' '}
            <span className="count">{count(audit, 'isRepeating')}</span>
          </li>
          {breachCheck && (
            <li>
              <span className="marker level-three"></span>
              {t('Breached')}{' '}
              <span className="count">{count(audit, 'breached')}</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

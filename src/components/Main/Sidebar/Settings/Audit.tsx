import type { ChangeEvent } from 'react'
import { useStore, setBreachCheck, runAudit } from '@/store'
import { t } from '@/i18n'
import type { Section } from './Navigation'

interface Props {
  section: Section
}

export default function Audit({ section }: Props) {
  const breachCheck = useStore(state => state.breachCheck)

  const onToggle = (e: ChangeEvent<HTMLInputElement>) => {
    setBreachCheck(e.target.checked)
    runAudit()
  }

  if (section !== 'audit') return null

  return (
    <>
      <h1>{t('Password Audit')}</h1>
      <div className="section">
        <strong>{t('Check for breaches')}</strong>
        <div>
          {t(
            'Compares your passwords against the Have I Been Pwned database of leaked passwords.'
          )}
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              name="breachCheck"
              checked={breachCheck}
              onChange={onToggle}
            />
            {t('Enable breach check (sends network requests)')}
          </label>
        </div>
        <div className="muted">
          {t(
            'Privacy: only the first 5 characters of each password’s SHA-1 hash are sent (k-anonymity). Your password and its full hash never leave this device. Off by default.'
          )}
        </div>
      </div>
    </>
  )
}

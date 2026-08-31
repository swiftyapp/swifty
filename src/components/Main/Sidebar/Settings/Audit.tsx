import type { ChangeEvent } from 'react'
import { useStore, setBreachCheck, runAudit } from '@/store'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import { H1, Section as Row, LABEL, DESC, MUTED, Checkbox } from './ui'

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
      <h1 className={H1}>{t('Password Audit')}</h1>
      <Row>
        <strong className={LABEL}>{t('Check for breaches')}</strong>
        <p className={DESC}>
          {t(
            'Compares your passwords against the Have I Been Pwned database of leaked passwords.'
          )}
        </p>
        <Checkbox name="breachCheck" checked={breachCheck} onChange={onToggle}>
          {t('Enable breach check (sends network requests)')}
        </Checkbox>
        <p className={MUTED}>
          {t(
            'Privacy: only the first 5 characters of each password’s SHA-1 hash are sent (k-anonymity). Your password and its full hash never leave this device. Off by default.'
          )}
        </p>
      </Row>
    </>
  )
}

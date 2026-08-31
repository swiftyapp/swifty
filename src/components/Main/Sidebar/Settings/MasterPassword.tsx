import { useState } from 'react'
import { changeMasterPassword } from '@/lib/commands'
import { t } from '@/i18n'
import type { Section } from './Navigation'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { H1, Section as Row, LABEL, DANGER, SUCCESS, StatusRow } from './ui'

interface Props {
  section: Section
}

export default function MasterPassword({ section }: Props) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [processing, setProcessing] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const disabled = !current || !next || !confirmation || next !== confirmation

  const onSubmit = () => {
    if (disabled) return
    setProcessing(true)
    setError(null)
    setSuccess(null)
    changeMasterPassword(current, next)
      .then(() => {
        setCurrent('')
        setNext('')
        setConfirmation('')
        setSuccess(t('Successfully changed password'))
      })
      .catch(err => setError(String(err?.message ?? err)))
      .finally(() => setProcessing(false))
  }

  if (section !== 'masterpassword') return null

  return (
    <>
      <h1 className={H1}>{t('Change Master Password')}</h1>
      <Row>
        <strong className={LABEL}>{t('Current Password')}</strong>
        <input
          type="password"
          name="current_password"
          className={`${inputClass} max-w-md`}
          value={current}
          onChange={e => setCurrent(e.target.value)}
        />
      </Row>
      <Row>
        <strong className={LABEL}>{t('New Password')}</strong>
        <input
          type="password"
          name="new_password"
          className={`${inputClass} max-w-md`}
          value={next}
          onChange={e => setNext(e.target.value)}
        />
      </Row>
      <Row>
        <strong className={LABEL}>{t('Repeat New Password')}</strong>
        <input
          type="password"
          name="new_password_repeat"
          className={`${inputClass} max-w-md`}
          value={confirmation}
          onChange={e => setConfirmation(e.target.value)}
        />
      </Row>
      <StatusRow>
        <Button onClick={onSubmit} disabled={disabled} loading={processing}>
          {t('Update')}
        </Button>
        {error && <span className={DANGER}>{error}</span>}
        {success && <span className={SUCCESS}>{success}</span>}
      </StatusRow>
    </>
  )
}

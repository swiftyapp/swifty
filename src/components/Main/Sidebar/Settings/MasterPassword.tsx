import { useState } from 'react'
import { cx } from '@/utils/cx'
import { changeMasterPassword } from '@/lib/commands'
import { t } from '@/i18n'
import type { Section } from './Navigation'

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
      <h1>{t('Change Master Password')}</h1>
      <div className="section">
        <strong>{t('Current Password')}</strong>
        <div className="threefour">
          <input
            type="password"
            name="current_password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
          />
        </div>
      </div>
      <div className="section">
        <strong>{t('New Password')}</strong>
        <div className="threefour">
          <input
            type="password"
            name="new_password"
            value={next}
            onChange={e => setNext(e.target.value)}
          />
        </div>
      </div>
      <div className="section">
        <strong>{t('Repeat New Password')}</strong>
        <div className="threefour">
          <input
            type="password"
            name="new_password_repeat"
            value={confirmation}
            onChange={e => setConfirmation(e.target.value)}
          />
        </div>
      </div>
      <div className="status-button">
        <span
          onClick={onSubmit}
          className={cx('button', { disabled, loading: processing })}
        >
          {t('Update')}
        </span>
        {error && <span className="danger">{error}</span>}
        {success && <span className="success">{success}</span>}
      </div>
    </>
  )
}

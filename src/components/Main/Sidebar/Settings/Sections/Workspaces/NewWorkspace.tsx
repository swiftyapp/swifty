import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createWorkspace } from '@/store'
import { messageOf } from '@/api/errors'
import { masterPasswordError } from '@/services/strength'
import SettingsRow from '@/components/elements/SettingsRow'
import Masterpass from '@/components/elements/Masterpass'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'

// Creating a second (or third) encrypted database. Both password fields belong
// together for the same reason the first run's do — the second is a check on
// the first — so this is the setup screen's form, condensed into a settings
// group and holding to the same bar via `masterPasswordError`.
//
// Creating opens the new workspace immediately: `workspace_create` hands back
// an unlocked session, so the settings modal is left behind by the flow change
// rather than dismissed here.
export default function NewWorkspace() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mismatch, setMismatch] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const changePassword = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  const changeConfirmation = (event: ChangeEvent<HTMLInputElement>) => {
    setMismatch(null)
    setConfirmation(event.currentTarget.value)
  }

  const submit = () => {
    if (busy) return
    if (!name.trim()) return setMismatch(t('Fill in the name'))
    const weak = masterPasswordError(password, t)
    if (weak) return setError(weak)
    if (password !== confirmation) return setMismatch(t('Passwords do not match'))

    setBusy(true)
    createWorkspace(name.trim(), password).catch((err: unknown) => {
      setBusy(false)
      setMismatch(messageOf(err) || t('Something went wrong'))
    })
  }

  return (
    <SettingsRow
      label={t('Add a workspace')}
      description={t(
        'Each workspace is a separate encrypted database with its own master password. Sync and biometric unlock stay with your primary workspace for now.'
      )}
      testid="workspace-new-row"
    >
      <div className="flex max-w-xs flex-col gap-3">
        <input
          type="text"
          className={inputClass}
          data-testid="workspace-new-name"
          placeholder={t('Workspace name')}
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <Masterpass
          placeholder={t('Master password')}
          testid="workspace-new-password"
          autoFocus={false}
          error={error}
          onEnter={() => setError(masterPasswordError(password, t))}
          onChange={changePassword}
        />
        <Masterpass
          placeholder={t('Type it once more')}
          testid="workspace-new-confirm"
          autoFocus={false}
          error={mismatch}
          onEnter={submit}
          onChange={changeConfirmation}
        />
        <div>
          <Button size="md" testid="workspace-create" loading={busy} onClick={submit}>
            {t('Create')}
          </Button>
        </div>
      </div>
    </SettingsRow>
  )
}

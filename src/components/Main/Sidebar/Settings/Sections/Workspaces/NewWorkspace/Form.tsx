import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createWorkspace } from '@/store'
import { messageOf } from '@/api/errors'
import Masterpass from '@/components/elements/Masterpass'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'

// Creating a second (or third) encrypted database. There is one master
// password for the device, so the form asks for it rather than for a new one:
// the backend proves it against the primary before creating anything, which
// is what keeps every workspace under the same password — and what lets the
// whole app open with one unlock. A wrong one is the unlock's own error.
//
// Creating opens the new workspace immediately: `workspace_create` hands back
// an unlocked session, so the settings modal is left behind by the flow change
// rather than dismissed here.
export default function Form() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const changePassword = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  // The fields are read once here and disabled while busy, so what is created
  // is exactly what is on screen.
  const submit = async () => {
    if (busy) return
    const label = name.trim()
    if (!label) return setError(t('Fill in the name'))
    if (!password) return setError(t('Fill in your master password'))
    setBusy(true)
    try {
      await createWorkspace(label, password)
    } catch (err: unknown) {
      setBusy(false)
      setError(messageOf(err) || t('Something went wrong'))
    }
  }

  return (
    <div className="flex max-w-xs flex-col gap-3">
      <input
        type="text"
        autoFocus
        className={inputClass}
        data-testid="workspace-new-name"
        placeholder={t('Workspace name')}
        value={name}
        disabled={busy}
        onChange={event => setName(event.target.value)}
      />
      <Masterpass
        placeholder={t('Master password')}
        testid="workspace-new-password"
        autoFocus={false}
        disabled={busy}
        error={error}
        onEnter={() => void submit()}
        onChange={changePassword}
      />
      <div>
        <Button size="md" testid="workspace-create" loading={busy} onClick={() => void submit()}>
          {t('Create')}
        </Button>
      </div>
    </div>
  )
}

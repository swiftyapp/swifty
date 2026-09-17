import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { SetupDriveFile } from '@/api/setup'
import {
  restoreWorkspaceFromDrive,
  setupDriveSelect,
  switchWorkspaceDriveAccount
} from '@/store'
import DriveVaults from '@/components/elements/DriveVaults'
import Masterpass from '@/components/elements/Masterpass'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { unsealError } from '@/components/Start/shared/errors'

interface Props {
  files: SetupDriveFile[]
  selectedId: string | null
}

// Which vault, what to call it here, and the password it was sealed with.
//
// No strength bar and no confirmation field, unlike `NewWorkspace`: this
// password is not being chosen, it is being recalled — it belongs to a vault
// another device created, and the only thing that can judge it is the pack.
export default function RestoreForm({ files, selectedId }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const change = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setPassword(event.currentTarget.value)
  }

  // The fields are read once here and disabled while busy, so what is restored
  // is exactly what is on screen — the same bargain `NewWorkspace` makes.
  const submit = () => {
    if (busy || !selectedId) return
    const label = name.trim()
    if (!label) return setNameError(t('Fill in the name'))
    setBusy(true)
    setError(null)
    restoreWorkspaceFromDrive(label, password, selectedId).catch((err: unknown) => {
      setBusy(false)
      setError(
        unsealError(
          t,
          err,
          t("That isn't the password this was sealed with. Try the one you use on your other devices.")
        )
      )
    })
  }

  return (
    <div className="flex max-w-xs flex-col gap-3">
      <DriveVaults files={files} selectedId={selectedId} onSelect={setupDriveSelect} />
      <input
        type="text"
        className={inputClass}
        data-testid="workspace-restore-name"
        placeholder={t('Workspace name')}
        value={name}
        disabled={busy}
        onChange={event => {
          setNameError(null)
          setName(event.target.value)
        }}
      />
      {nameError && (
        <div data-testid="workspace-restore-name-error" className="text-base text-bad">
          {nameError}
        </div>
      )}
      <Masterpass
        placeholder={t('Master password')}
        testid="workspace-restore-password"
        autoFocus={false}
        disabled={busy}
        error={error}
        onEnter={submit}
        onChange={change}
      />
      <div className="flex items-center gap-4">
        <Button size="md" testid="workspace-restore-submit" loading={busy} onClick={submit}>
          {busy ? t('Restoring…') : t('Restore')}
        </Button>
        {/* Withdrawn while the restore runs: it has already taken the account
            it is restoring from, and the backend would refuse the swap. */}
        {!busy && (
          <Button
            variant="pale"
            size="md"
            testid="workspace-restore-switch-account"
            onClick={switchWorkspaceDriveAccount}
          >
            {t('Switch account')}
          </Button>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace } from '@/api/types'
import { deleteWorkspace } from '@/store'
import { unsealError } from '@/components/Start/shared/errors'
import { workspaceLabel } from '@/lib/workspace'
import Frame from '@/components/elements/Frame'
import Button from '@/components/elements/Button'
import { inputClass } from '@/components/elements/formStyles'
import { verbatimInput } from '@/components/elements/inputProps'

const TITLE_ID = 'workspace-delete-title'

/**
 * Confirming the one destructive thing Settings › Workspaces can do.
 *
 * Two proofs rather than an armed button, because there is no undo and nothing
 * on screen would tell two workspaces apart afterwards: the vault's own master
 * password (which is also what the backend needs — a locked workspace cannot be
 * opened to check it against the session), and the label typed out, which is
 * what makes "this one" deliberate.
 *
 * In a `Frame`, so the phone gets the same dialog as a sheet.
 */
export default function DeleteWorkspace({
  workspace,
  onClose
}: {
  workspace: Workspace
  onClose: () => void
}) {
  const { t } = useTranslation()
  const label = workspaceLabel(workspace, t)
  const [password, setPassword] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ready = password.length > 0 && typed.trim() === label

  // Nothing to close on success: deleting the open workspace ends its session,
  // and the lock that follows takes the whole settings surface with it. When it
  // was another one, the re-probe has already redrawn the list behind this.
  const submit = () => {
    if (!ready || busy) return
    setBusy(true)
    setError(null)
    deleteWorkspace(workspace.id, password)
      .then(onClose)
      .catch((err: unknown) => {
        setError(
          unsealError(t, err, t('That is not this workspace’s master password'))
        )
        setBusy(false)
      })
  }

  return (
    <Frame
      onClose={onClose}
      labelledBy={TITLE_ID}
      testid="workspace-delete-dialog"
      fit="content"
      className="flex max-h-[80vh] w-dialog"
    >
      {/* Tighter where the frame is a bottom sheet on a phone, as every other
          dialog body sizes itself: the card's own width decides, not the shell. */}
      <div className="@container w-full p-7 @max-[500px]:p-5">
        <h2 id={TITLE_ID} className="text-lg font-semibold tracking-display">
          {t('Delete {{name}}?', { name: label })}
        </h2>
        <p className="mt-1.5 text-base text-text2">
          {t(
            'This removes the workspace and everything in it from this device. A copy on Google Drive is left where it is, so the account still holds it.'
          )}
        </p>

        <label className="mt-5 block">
          <span className="text-base text-text2">
            {t('Master password of this workspace')}
          </span>
          <input
            type="password"
            name="workspace_delete_password"
            {...verbatimInput}
            data-testid="workspace-delete-password"
            className={`${inputClass} mt-1.5`}
            value={password}
            disabled={busy}
            onChange={event => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <p data-testid="workspace-delete-error" className="mt-1.5 text-base text-bad">
            {error}
          </p>
        )}

        <label className="mt-4 block">
          <span className="text-base text-text2">
            {t('Type {{name}} to confirm', { name: label })}
          </span>
          <input
            type="text"
            {...verbatimInput}
            data-testid="workspace-delete-confirm"
            className={`${inputClass} mt-1.5`}
            value={typed}
            disabled={busy}
            onChange={event => setTyped(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && submit()}
          />
        </label>

        <div className="mt-5 flex items-center gap-2">
          <Button
            variant="pale"
            size="md"
            className="text-bad hover:text-bad"
            testid="workspace-delete-submit"
            disabled={!ready}
            loading={busy}
            onClick={submit}
          >
            {busy ? t('Deleting…') : t('Delete')}
          </Button>
          <Button
            variant="pale"
            size="md"
            testid="workspace-delete-cancel"
            disabled={busy}
            onClick={onClose}
          >
            {t('Cancel')}
          </Button>
        </div>
      </div>
    </Frame>
  )
}

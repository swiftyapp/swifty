import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp, selectWorkspaces, selectActiveWorkspace, switchWorkspace } from '@/store'
import { messageOf } from '@/api/errors'
import { workspaceLabel } from '@/lib/workspace'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'
import DeleteWorkspace from './DeleteWorkspace'

export default function WorkspaceList() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)
  // The one way a switch is refused: a sync flow is mid-flight in this
  // workspace, and moving the paths under it would land its files elsewhere.
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // A device always has a vault to open, so the last workspace stays. Every
  // other one may go, the open one included: deleting it ends its session and
  // the app comes back on a survivor's lock screen.
  const last = list.length < 2
  const chosen = list.find(workspace => workspace.id === deleting)

  return (
    <>
      {list.map(workspace => {
        const current = workspace.id === active
        return (
          <SettingsRow
            key={workspace.id}
            label={workspaceLabel(workspace, t)}
            description={current ? t('Current') : undefined}
            testid={`workspace-row-${workspace.id}`}
            control={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {!current && (
                  <Button
                    variant="pale"
                    size="md"
                    testid={`workspace-switch-${workspace.id}`}
                    onClick={() =>
                      switchWorkspace(workspace.id).catch((err: unknown) =>
                        setError(messageOf(err))
                      )
                    }
                  >
                    {t('Switch')}
                  </Button>
                )}
                <Button
                  variant="pale"
                  size="md"
                  className="text-bad hover:text-bad"
                  testid={`workspace-delete-${workspace.id}`}
                  disabled={last}
                  onClick={() => setDeleting(workspace.id)}
                >
                  {t('Delete')}
                </Button>
              </div>
            }
          />
        )
      })}
      {last && (
        <div data-testid="workspace-delete-last" className="px-4 py-3 text-base text-text2">
          {t('Your only workspace cannot be deleted. Add another one first.')}
        </div>
      )}
      {error && (
        <div data-testid="workspace-switch-error" className="px-4 py-3 text-base text-bad">
          {error}
        </div>
      )}
      {chosen && (
        <DeleteWorkspace workspace={chosen} onClose={() => setDeleting(null)} />
      )}
    </>
  )
}

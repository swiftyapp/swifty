import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp, selectWorkspaces, selectActiveWorkspace, switchWorkspace } from '@/store'
import { messageOf } from '@/api/errors'
import { workspaceLabel } from '@/lib/workspace'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'

export default function WorkspaceList() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)
  // The one way a switch is refused: a sync flow is mid-flight in this
  // workspace, and moving the paths under it would land its files elsewhere.
  const [error, setError] = useState<string | null>(null)

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
              current ? undefined : (
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
              )
            }
          />
        )
      })}
      {error && (
        <div data-testid="workspace-switch-error" className="px-4 py-3 text-base text-bad">
          {error}
        </div>
      )}
    </>
  )
}

import { useTranslation } from 'react-i18next'
import { useStore, switchWorkspace } from '@/store'
import { workspaceLabel } from '@/lib/workspace'
import SettingsRow from '@/components/elements/SettingsRow'
import Button from '@/components/elements/Button'

// Every workspace on this install, the open one marked. Switching locks the
// vault, so the button hands the app to the other workspace's lock screen —
// there is nothing to confirm afterwards, and nothing more this row can say.
export default function WorkspaceList() {
  const { t } = useTranslation()
  const { list, active } = useStore(state => state.workspaces)

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
                  onClick={() => void switchWorkspace(workspace.id)}
                >
                  {t('Switch')}
                </Button>
              )
            }
          />
        )
      })}
    </>
  )
}

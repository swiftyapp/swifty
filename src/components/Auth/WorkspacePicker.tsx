import { useTranslation } from 'react-i18next'
import { useApp, selectWorkspaces, selectActiveWorkspace, switchWorkspace } from '@/store'
import { workspaceLabel } from '@/lib/workspace'
import Segmented from '@/components/elements/Segmented'

// Which workspace the lock screen is about to unlock. Nothing to draw until
// there is a second one to choose instead.
export default function WorkspacePicker() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)

  if (list.length < 2) return null

  return (
    <div data-testid="workspace-picker" className="mb-6 flex justify-center">
      <Segmented
        name={t('Workspaces')}
        options={list.map(workspace => ({
          value: workspace.id,
          label: workspaceLabel(workspace, t)
        }))}
        value={active}
        testidPrefix="workspace-option"
        onChange={id => {
          // Nothing is unlocked here, so the one refusal the backend has
          // (a sync in flight) cannot apply; a failure is only worth a log.
          if (id !== active) switchWorkspace(id).catch(() => {})
        }}
      />
    </div>
  )
}

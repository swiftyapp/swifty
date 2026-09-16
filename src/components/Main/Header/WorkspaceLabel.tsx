import { useTranslation } from 'react-i18next'
import { useApp, selectWorkspaces, selectActiveWorkspace } from '@/store'
import { workspaceLabel } from '@/lib/workspace'

// Which workspace is open, once there is more than one it could be.
export default function WorkspaceLabel() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)

  if (list.length < 2) return null
  const current = list.find(workspace => workspace.id === active)
  if (!current) return null

  return (
    <span data-testid="header-workspace" className="text-base text-text3">
      {workspaceLabel(current, t)}
    </span>
  )
}

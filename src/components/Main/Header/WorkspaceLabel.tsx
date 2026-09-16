import { useTranslation } from 'react-i18next'
import { useStore } from '@/store'
import { workspaceLabel } from '@/lib/workspace'

// Which workspace is open, for the installs that have more than one. A label
// and not a menu: switching locks the vault, which is far too much to hang off
// the chrome one click from the entry list — it lives in Settings, where the
// consequence can be read before it is taken.
export default function WorkspaceLabel() {
  const { t } = useTranslation()
  const { list, active } = useStore(state => state.workspaces)

  if (list.length < 2) return null
  const current = list.find(workspace => workspace.id === active)
  if (!current) return null

  return (
    <span data-testid="header-workspace" className="text-base text-text3">
      {workspaceLabel(current, t)}
    </span>
  )
}

import { useEffect } from 'react'
import { useApp, selectActiveWorkspace, selectWorkspaces } from '@/store'
import { useSubpage } from '../../../sectionNav'
import type { Subpage } from '../../../subpages'
import { workspaceSyncs } from '../about'
import Confirm from './Confirm'

// The delete as a page of its own under Workspaces, like Edit: the row's menu
// opens it, and the list is what it goes back to. A workspace that is gone by
// the time it draws — deleted here, or from the row while this was open — has
// nothing to confirm, so the page steps back out.
export default function DeleteWorkspaceSubpage({
  subpage
}: {
  subpage: Extract<Subpage, { key: 'delete-workspace' }>
}) {
  const workspace = useApp(selectWorkspaces).find(({ id }) => id === subpage.id)
  const active = useApp(selectActiveWorkspace)
  const sync = useApp(state => state.sync)
  const { close } = useSubpage()

  useEffect(() => {
    if (!workspace) close()
  }, [workspace, close])

  return workspace ? (
    <Confirm
      key={workspace.id}
      workspace={workspace}
      syncs={workspaceSyncs(workspace, { active, sync })}
    />
  ) : null
}

import { Fragment, useEffect, type ReactNode } from 'react'
import type { Workspace } from '@/api/types'
import { useApp, selectWorkspaces } from '@/store'
import { useSubpage } from '../../sectionNav'

// A sub-page about one workspace looks it up rather than being handed it, so
// a delete from elsewhere (the picker, another device's sync) steps the page
// back out instead of leaving it on something that is gone. Keyed by id, so
// the fields inside start over from whichever workspace is shown.
export default function ForWorkspace({
  id,
  children
}: {
  id: string
  children: (workspace: Workspace) => ReactNode
}) {
  const workspace = useApp(selectWorkspaces).find(workspace => workspace.id === id)
  const { close } = useSubpage()

  useEffect(() => {
    if (!workspace) close()
  }, [workspace, close])

  return workspace ? <Fragment key={workspace.id}>{children(workspace)}</Fragment> : null
}

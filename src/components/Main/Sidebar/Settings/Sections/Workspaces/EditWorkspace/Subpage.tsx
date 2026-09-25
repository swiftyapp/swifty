import { useEffect } from 'react'
import { useApp, selectWorkspaces } from '@/store'
import { useSubpage } from '../../../sectionNav'
import type { Subpage } from '../../../subpages'
import Editor from './Editor'

// The workspace is looked up rather than handed over, so a delete from
// elsewhere (the picker, another window's sync) steps back out instead of
// editing something that is gone.
export default function EditWorkspaceSubpage({
  subpage
}: {
  subpage: Extract<Subpage, { key: 'edit-workspace' }>
}) {
  const workspace = useApp(selectWorkspaces).find(({ id }) => id === subpage.id)
  const { close } = useSubpage()

  useEffect(() => {
    if (!workspace) close()
  }, [workspace, close])

  // Keyed, so the fields start over from whichever workspace is shown.
  return workspace ? <Editor key={workspace.id} workspace={workspace} /> : null
}

import type { Subpage } from '../../../subpages'
import ForWorkspace from '../ForWorkspace'
import Editor from './Editor'

export default function EditWorkspaceSubpage({
  subpage
}: {
  subpage: Extract<Subpage, { key: 'edit-workspace' }>
}) {
  return <ForWorkspace id={subpage.id}>{workspace => <Editor workspace={workspace} />}</ForWorkspace>
}

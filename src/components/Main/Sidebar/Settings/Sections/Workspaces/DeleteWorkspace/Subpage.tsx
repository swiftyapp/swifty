import type { Subpage } from '../../../subpages'
import ForWorkspace from '../ForWorkspace'
import Confirm from './Confirm'

export default function DeleteWorkspaceSubpage({
  subpage
}: {
  subpage: Extract<Subpage, { key: 'delete-workspace' }>
}) {
  return <ForWorkspace id={subpage.id}>{workspace => <Confirm workspace={workspace} />}</ForWorkspace>
}

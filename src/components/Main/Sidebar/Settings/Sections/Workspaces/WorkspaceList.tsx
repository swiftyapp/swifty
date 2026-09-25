import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useApp,
  useVault,
  selectWorkspaces,
  selectActiveWorkspace,
  switchWorkspace
} from '@/store'
import { messageOf } from '@/api/errors'
import type { Workspace } from '@/api/types'
import { syncDeletedRemotely, syncErrorText } from '@/api/sync'
import Button from '@/components/elements/Button'
import WorkspaceRow from './WorkspaceRow'
import DeleteWorkspace from './DeleteWorkspace'
import { workspaceAbout } from './about'

export default function WorkspaceList() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)
  const sync = useApp(state => state.sync)
  const liveCount = useVault(state => state.items.length)
  // The one way a switch is refused: a sync flow is mid-flight in this
  // workspace, and moving the paths under it would land its files elsewhere.
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // A device always has a vault to open, so the last workspace stays. Every
  // other one may go, the open one included: deleting it ends its session and
  // the app comes back on a survivor's lock screen.
  const last = list.length < 2
  const chosen = list.find(workspace => workspace.id === deleting)

  // The account's copy of *this* vault is gone — deleted from another device —
  // so its runs stop here until this workspace goes too. The delete offered for
  // it is the local one: there is nothing left on Drive to remove.
  const strandedHere = syncDeletedRemotely(sync)

  // Whether a workspace syncs, and so has a copy on Drive to delete along with
  // it. The open one is answered by its live connection; a locked one by the
  // connection the backend found in its own directory when the list was built
  // (`synced`) — not by its vault id, which a disconnect leaves behind.
  const syncs = (workspace: Workspace) =>
    workspace.id === active ? sync.configured && !strandedHere : workspace.synced === true

  return (
    <>
      {list.map(workspace => {
        const current = workspace.id === active
        return (
          <WorkspaceRow
            key={workspace.id}
            workspace={workspace}
            current={current}
            last={last}
            about={workspaceAbout(
              workspace,
              { current, syncs: syncs(workspace), liveCount },
              t
            )}
            onSwitch={() =>
              switchWorkspace(workspace.id).catch((err: unknown) => setError(messageOf(err)))
            }
            onDelete={() => setDeleting(workspace.id)}
          />
        )
      })}
      {strandedHere && (
        <div
          data-testid="workspace-deleted-remotely"
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-text2 inset-shadow-hairline"
        >
          <span className="text-bad">{syncErrorText(sync)}</span>
          <Button
            variant="pale"
            size="md"
            className="text-bad hover:text-bad"
            testid="workspace-delete-stranded"
            disabled={last}
            onClick={() => setDeleting(active)}
          >
            {t('Delete it here too')}
          </Button>
        </div>
      )}
      {last && (
        <div
          data-testid="workspace-delete-last"
          className="px-4 py-3 text-sm text-text2 inset-shadow-hairline"
        >
          {t('Your only workspace cannot be deleted. Add another one first.')}
        </div>
      )}
      {error && (
        <div
          data-testid="workspace-switch-error"
          className="px-4 py-3 text-sm text-bad inset-shadow-hairline"
        >
          {error}
        </div>
      )}
      {chosen && (
        <DeleteWorkspace
          workspace={chosen}
          syncs={syncs(chosen)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Workspace } from '@/api/types'
import { workspaceLabel } from '@/lib/workspace'
import { cx } from '@/utils/cx'
import Button from '@/components/elements/Button'
import Monogram from '@/components/elements/Monogram'
import { META, META_TYPE, ROW_HAIRLINE } from '@/components/elements/tokens'
import Menu from './Menu'
import RenameField from './RenameField'

interface Props {
  workspace: Workspace
  // The open one: marked, and not offered as a place to switch to.
  current: boolean
  last: boolean
  // Its size and where it lives, already translated.
  about: string
  onSwitch: () => void
  onDelete: () => void
}

function OpenNow() {
  const { t } = useTranslation()
  return (
    <span
      className={`flex h-5 flex-none items-center gap-1.5 rounded-full bg-good/10 px-2 ${META_TYPE} font-medium text-good`}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {t('Open now')}
    </span>
  )
}

// One workspace on this device: its tile, its name over what is known of it,
// Switch when it is not the open one, and the rest behind ⋯. Rename unfolds
// in the row itself, under the name.
export default function WorkspaceRow({
  workspace,
  current,
  last,
  about,
  onSwitch,
  onDelete
}: Props) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const label = workspaceLabel(workspace, t)

  return (
    <div data-testid={`workspace-row-${workspace.id}`} className={cx('px-4 py-3.5', ROW_HAIRLINE)}>
      <div className="flex items-center gap-3.5">
        <Monogram name={label} seed={workspace.id} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-base font-medium text-text">{label}</span>
            {current && <OpenNow />}
          </div>
          <div className={cx(META, 'mt-0.5 truncate')}>{about}</div>
        </div>
        <div className="flex flex-none items-center gap-1.5">
          {!current && (
            <Button
              variant="pale"
              size="md"
              testid={`workspace-switch-${workspace.id}`}
              onClick={onSwitch}
            >
              {t('Switch')}
            </Button>
          )}
          <Menu
            id={workspace.id}
            last={last}
            onRename={() => setRenaming(true)}
            onDelete={onDelete}
          />
        </div>
      </div>
      {renaming && (
        <div className="mt-3 pl-[50px]">
          <RenameField workspace={workspace} onDone={() => setRenaming(false)} />
        </div>
      )}
    </div>
  )
}

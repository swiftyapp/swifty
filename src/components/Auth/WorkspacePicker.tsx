import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp, selectWorkspaces, selectActiveWorkspace, switchWorkspace } from '@/store'
import type { Workspace } from '@/api/types'
import { workspaceLabel } from '@/lib/workspace'
import { cx } from '@/utils/cx'
import Monogram from '@/components/elements/Monogram'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'
import { CheckGlyph, ChevronDownGlyph } from '@/components/Main/icons'

// Which workspace the lock screen is about to unlock, worn as an identity: a
// quiet chip with the vault's monogram and name, and the others one click away
// in a menu of the same rows. Only the one being opened is on the screen, so
// nothing competes with the field under it — and ten vaults cost no more room
// than two. Nothing to draw until there is a second one to choose instead.
export default function WorkspacePicker() {
  const { t } = useTranslation()
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)
  const configured = useApp(state => state.sync.configured)
  const [open, setOpen] = useState(false)
  const chip = useRef<HTMLButtonElement>(null)

  if (list.length < 2) return null
  const current = list.find(workspace => workspace.id === active) ?? list[0]

  // Where a vault lives, from what is readable while it is locked: the open
  // one's live connection, any other's the vault id a sync of its once settled.
  const home = (workspace: Workspace) =>
    (workspace.id === active ? configured : workspace.vaultId !== undefined)
      ? t('Google Drive')
      : t('This device')

  const pick = (id: string) => {
    setOpen(false)
    // The row that was picked unmounts with the menu, so focus would fall to
    // the body; it goes back to the chip, as it does on Escape. A switch that
    // relocks the screen redraws the chip in place, so the focus holds there.
    chip.current?.focus()
    // Nothing is unlocked here, so the one refusal the backend has (a sync in
    // flight) cannot apply; a failure is only worth a log.
    if (id !== active) switchWorkspace(id).catch(() => {})
  }

  return (
    <div data-testid="workspace-picker" className="relative mb-5 flex justify-center">
      <button
        ref={chip}
        type="button"
        data-testid="workspace-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        // The accessible name is the vault's own (the monogram is decorative),
        // so what is about to open is what is read out; the hint that it can
        // be changed is the title, not a label over the name.
        title={t('Switch vault')}
        onClick={() => setOpen(value => !value)}
        className={cx(
          'flex h-8 cursor-pointer items-center gap-2 rounded-full pl-1 pr-2.5 text-base font-medium text-text transition-colors',
          open ? 'bg-tile ring-1 ring-line2 ring-inset' : 'bg-hover hover:bg-tile'
        )}
      >
        <Monogram name={workspaceLabel(current, t)} seed={current.id} size={24} />
        <span className="max-w-[180px] truncate">{workspaceLabel(current, t)}</span>
        <span
          className={cx('text-text3 transition-transform', open && 'rotate-180')}
        >
          <ChevronDownGlyph size={12} />
        </span>
      </button>

      {open && (
        // Capped at six rows and scrolling past that, so the panel stays
        // inside the window at its smallest and a long list costs no room.
        <div className="absolute top-full z-20 mt-2 w-[280px]">
          <Dropdown
            onBlur={() => setOpen(false)}
            className="inset-x-0 max-h-[270px] overflow-y-auto py-1.5"
          >
            {list.map(workspace => {
              const selected = workspace.id === active
              return (
                <DropdownItem
                  key={workspace.id}
                  testid={`workspace-option-${workspace.id}`}
                  checked={selected}
                  onClick={() => pick(workspace.id)}
                  className="py-1.5"
                >
                  <Monogram name={workspaceLabel(workspace, t)} seed={workspace.id} size={28} />
                  <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
                    <span className="truncate font-medium text-text">
                      {workspaceLabel(workspace, t)}
                    </span>
                    <span className="truncate text-xs text-text2">{home(workspace)}</span>
                  </span>
                  <span className="grid w-4 flex-none place-items-center text-accent">
                    {selected && <CheckGlyph />}
                  </span>
                </DropdownItem>
              )
            })}
          </Dropdown>
        </div>
      )}
    </div>
  )
}

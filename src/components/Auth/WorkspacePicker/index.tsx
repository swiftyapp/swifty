import { useRef, useState } from 'react'
import { useApp, selectWorkspaces, selectActiveWorkspace, switchWorkspace } from '@/store'
import Chip from './Chip'
import Menu from './Menu'
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts'

// Which vault the lock screen is about to open, and the way to another: a chip
// naming the current one over a menu of them all. Drawn only when there is a
// choice to make.
export default function WorkspacePicker() {
  const list = useApp(selectWorkspaces)
  const active = useApp(selectActiveWorkspace)
  const [open, setOpen] = useState(false)
  const chip = useRef<HTMLButtonElement>(null)

  const select = (id: string) => {
    if (id !== active) switchWorkspace(id).catch(() => {})
  }

  // Picked from the menu: the row goes with it, so the keyboard lands back on
  // the chip rather than on the body.
  const pick = (id: string) => {
    setOpen(false)
    chip.current?.focus()
    select(id)
  }

  // A chord leaves the caret where it was — mid-passphrase, typically — unless
  // the menu it would otherwise be stranded in was open.
  useWorkspaceShortcuts(list.length < 2 ? [] : list, id => (open ? pick(id) : select(id)))

  if (list.length < 2) return null
  const current = list.find(workspace => workspace.id === active) ?? list[0]

  return (
    <div data-testid="workspace-picker" className="relative mb-5 flex justify-center">
      <Chip ref={chip} workspace={current} open={open} onClick={() => setOpen(value => !value)} />
      {open && (
        <Menu list={list} active={active} onPick={pick} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

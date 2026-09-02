import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown, DropdownItem } from '@/components/elements/Dropdown'

const Harness = ({ onPick = vi.fn() }: { onPick?: (label: string) => void }) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" data-testid="trigger" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Dropdown onBlur={() => setOpen(false)}>
          <DropdownItem testid="item-one" onClick={() => onPick('one')}>
            One
          </DropdownItem>
          <DropdownItem testid="item-two" onClick={() => onPick('two')}>
            Two
          </DropdownItem>
          <DropdownItem testid="item-three" onClick={() => onPick('three')}>
            Three
          </DropdownItem>
        </Dropdown>
      )}
    </div>
  )
}

const open = async () => {
  render(<Harness />)
  await userEvent.click(screen.getByTestId('trigger'))
}

describe('Dropdown', () => {
  it('exposes menu semantics and focuses the first item on open', async () => {
    await open()

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
    expect(screen.getByTestId('item-one')).toHaveFocus()
  })

  it('moves focus with the arrow keys, wrapping around the ends', async () => {
    await open()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByTestId('item-two')).toHaveFocus()

    // Past the last item, focus wraps to the first.
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByTestId('item-one')).toHaveFocus()

    // And back off the first end to the last.
    await userEvent.keyboard('{ArrowUp}')
    expect(screen.getByTestId('item-three')).toHaveFocus()
  })

  it('closes on Escape and hands focus back to the trigger', async () => {
    await open()

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByTestId('trigger')).toHaveFocus()
  })

  it('activates the focused item with Enter and with Space', async () => {
    const onPick = vi.fn()
    render(<Harness onPick={onPick} />)
    await userEvent.click(screen.getByTestId('trigger'))

    await userEvent.keyboard('{Enter}')
    expect(onPick).toHaveBeenLastCalledWith('one')

    await userEvent.keyboard('{ArrowDown} ')
    expect(onPick).toHaveBeenLastCalledWith('two')
  })

  it('closes when the scrim is clicked', async () => {
    await open()

    await userEvent.click(screen.getByTestId('dropdown-scrim'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

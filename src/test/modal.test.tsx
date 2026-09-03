import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from '@/components/Main/Sidebar/Settings'
import Modal from '@/components/elements/Modal'
import { renderWithStore } from './utils'

const openSettings = async () => {
  await userEvent.click(screen.getByTestId('settings-button'))
  return screen.getByTestId('settings-modal')
}

describe('Modal focus management', () => {
  it('moves focus inside the card when it opens', async () => {
    renderWithStore(<Settings />)
    const modal = await openSettings()

    expect(modal.contains(document.activeElement)).toBe(true)
  })

  it('keeps Tab from leaving the card', async () => {
    renderWithStore(<Settings />)
    const modal = await openSettings()

    const tabbables = modal.querySelectorAll<HTMLElement>('button, input, select')
    tabbables[tabbables.length - 1].focus()
    await userEvent.tab()

    expect(modal.contains(document.activeElement)).toBe(true)
  })

  it('returns focus to the trigger on close', async () => {
    renderWithStore(<Settings />)
    const trigger = screen.getByTestId('settings-button')
    await openSettings()
    // Park focus deep inside the card, so passing can only mean it was restored.
    screen.getByTestId('settings-nav-security').focus()

    await userEvent.keyboard('{Escape}')

    expect(trigger).toHaveFocus()
  })

  it('leaves the underlying dialog alone when a second one is on top', async () => {
    const onClose = vi.fn()
    render(
      <>
        <Modal onClose={onClose} testid="under">
          <button type="button">under</button>
        </Modal>
        <Modal onClose={vi.fn()} testid="over">
          <button type="button">over</button>
        </Modal>
      </>
    )

    await userEvent.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
  })
})

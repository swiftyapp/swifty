import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Generator from '@/components/Main/Generator'
import { useShortcuts } from '@/components/Main/useShortcuts'
import { copyToClipboard, generatePassword } from '@/lib/commands'
import { renderWithStore } from './utils'

// ⌘G lives in the app-level shortcut surface now (Main/useShortcuts), so the
// harness mounts it alongside the dialog the way Main does.
const Harness = () => {
  useShortcuts()
  return <Generator />
}

const open = async () => {
  await userEvent.keyboard('{Meta>}g{/Meta}')
  return screen.findByTestId('generator-dialog')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(generatePassword).mockResolvedValue('Generated123!')
})

describe('Generator', () => {
  it('stays closed until the shortcut is pressed', () => {
    renderWithStore(<Harness />)
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
  })

  it('opens on the shortcut and copies on confirm', async () => {
    renderWithStore(<Harness />)
    await open()
    expect(await screen.findByText('Generated123!')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('generator-use-button'))
    expect(copyToClipboard).toHaveBeenCalledWith('Generated123!', expect.any(Number))
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
  })

  it('closes on escape without copying', async () => {
    renderWithStore(<Harness />)
    await open()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
    expect(copyToClipboard).not.toHaveBeenCalled()
  })

  it('switches to memorable words without calling the random engine', async () => {
    renderWithStore(<Harness />)
    await open()
    vi.mocked(generatePassword).mockClear()

    await userEvent.click(screen.getByText('Memorable'))
    expect(await screen.findByText('Words')).toBeInTheDocument()
    expect(generatePassword).not.toHaveBeenCalled()
    expect(screen.getByTestId('generator-output').textContent).toMatch(/^[a-z]+(-[a-z]+)+-\d{2}$/)
  })
})

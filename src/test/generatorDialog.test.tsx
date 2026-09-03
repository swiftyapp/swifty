import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Generator from '@/components/Main/Generator'
import Main from '@/components/Main'
import { useShortcuts } from '@/components/Main/useShortcuts'
import { copyToClipboard, generatePassword } from '@/lib/commands'
import { makeStore, useStore, openPalette } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

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

// An open dialog owns the keyboard: every app-level chord stands down, and the
// dialog's own window handler only answers while it is the topmost one.
describe('Generator, with the shell behind it', () => {
  const seed = () => {
    const store = makeStore()
    withEntries(store, [loginMeta({ id: 'l1', title: 'Google' })])
    return store
  }

  const openGeneratorOver = async (ui = <Main />) => {
    renderWithStore(ui, { store: seed() })
    await userEvent.keyboard('{Meta>}g{/Meta}')
    return screen.findByTestId('generator-dialog')
  }

  it('swallows ⌘F rather than pulling focus into the column behind it', async () => {
    await openGeneratorOver()

    await userEvent.keyboard('{Meta>}f{/Meta}')

    expect(screen.getByTestId('search-input')).not.toHaveFocus()
  })

  it('swallows ⌘N rather than stacking the kind picker on top', async () => {
    await openGeneratorOver()

    await userEvent.keyboard('{Meta>}n{/Meta}')

    expect(screen.queryByTestId('add-secret-modal')).not.toBeInTheDocument()
    expect(useStore.getState().ui.addPicker).toBe(false)
  })

  it('leaves ⏎ to the palette stacked over it', async () => {
    await openGeneratorOver()
    expect(await screen.findByText('Generated123!')).toBeInTheDocument()
    // ⌘K is swallowed while a dialog is up, so the palette is opened the way
    // any other surface would open it.
    openPalette()

    const palette = await screen.findByTestId('command-palette')
    await userEvent.type(within(palette).getByTestId('command-palette-input'), '{Enter}')

    // The palette's own command ran; the generator did not also confirm.
    expect(useStore.getState().entries.new).toBe('login')
    expect(copyToClipboard).not.toHaveBeenCalled()
  })
})

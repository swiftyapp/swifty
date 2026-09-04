import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Generator from '@/components/Main/Generator'
import Main from '@/components/Main'
import { useShortcuts } from '@/components/Main/useShortcuts'
import { copyToClipboard, generatePassword, generateSshKey } from '@/lib/commands'
import { makeStore, useStore, openGenerator, openPalette, openSshGenerator } from '@/store'
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

// The keypair mode. Standalone it is a third tab that saves a new entry; from a
// password field it is not offered at all, and from the ssh editor it is the
// only thing the dialog is doing.
describe('Generator, SSH keys', () => {
  const PAIR = {
    privateKey:
      '-----BEGIN OPENSSH PRIVATE KEY-----\nc2VjcmV0\n-----END OPENSSH PRIVATE KEY-----\n',
    publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI',
    fingerprint: 'SHA256:GeneratedFingerprint'
  }

  const openSsh = async () => {
    await open()
    await userEvent.click(screen.getByTestId('generator-mode-ssh'))
    return screen.findByTestId('generator-ssh-public')
  }

  it('offers the SSH tab when opened standalone', async () => {
    renderWithStore(<Harness />)
    await open()
    expect(screen.getByTestId('generator-mode-ssh')).toBeInTheDocument()
  })

  it('hides the SSH tab when a password field is waiting for a value', async () => {
    renderWithStore(<Harness />)
    openGenerator(() => {})

    await screen.findByTestId('generator-dialog')
    expect(screen.getByTestId('generator-mode-random')).toBeInTheDocument()
    expect(screen.queryByTestId('generator-mode-ssh')).not.toBeInTheDocument()
  })

  it('shows the public key, the fingerprint and a masked private key', async () => {
    renderWithStore(<Harness />)
    await openSsh()

    expect(screen.getByTestId('generator-ssh-public')).toHaveTextContent(PAIR.publicKey)
    expect(screen.getByTestId('generator-ssh-fingerprint')).toHaveTextContent(PAIR.fingerprint)
    expect(screen.getByTestId('generator-ssh-private')).not.toHaveTextContent('OPENSSH')

    await userEvent.click(screen.getByTestId('generator-ssh-reveal'))
    expect(screen.getByTestId('generator-ssh-private')).toHaveTextContent('OPENSSH')
  })

  it('draws a fresh key for a changed comment', async () => {
    renderWithStore(<Harness />)
    await openSsh()
    vi.mocked(generateSshKey).mockClear()

    await userEvent.type(screen.getByTestId('generator-ssh-comment'), 'me')

    expect(generateSshKey).toHaveBeenLastCalledWith('me')
  })

  it('opens a prefilled ssh draft on "Save as SSH key"', async () => {
    renderWithStore(<Harness />)
    await openSsh()

    const save = screen.getByTestId('generator-use-button')
    expect(save).toHaveTextContent('Save as SSH key')
    await userEvent.click(save)

    expect(useStore.getState().entries.new).toBe('ssh')
    expect(useStore.getState().entries.prefill).toEqual(PAIR)
    // A private key does not go on the clipboard behind the user's back.
    expect(copyToClipboard).not.toHaveBeenCalled()
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
  })

  it('hands the whole pair back to the field that asked for one', async () => {
    renderWithStore(<Harness />)
    const applied = vi.fn()
    openSshGenerator(applied)

    await screen.findByTestId('generator-ssh-public')
    // Opened for a key, there is nothing else the dialog could switch to.
    expect(screen.queryByTestId('generator-mode-random')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('generator-use-button'))

    expect(applied).toHaveBeenCalledWith(PAIR)
    // The editor's own draft takes it; no new entry is started.
    expect(useStore.getState().entries.new).toBeNull()
    expect(screen.queryByTestId('generator-dialog')).not.toBeInTheDocument()
  })
})

// An open dialog owns the keyboard: every app-level chord stands down, and the
// dialog's own window handler only answers while it is the topmost one.
describe('Generator, with the shell behind it', () => {
  const seed = () => {
    const store = makeStore()
    withEntries([loginMeta({ id: 'l1', title: 'Google' })])
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

// A draw takes a round-trip to Rust. Until it lands, the pair on screen is the
// one the user asked to replace, so nothing may accept it; and a refused draw
// says so instead of leaving empty fields and a button that does nothing.
describe('Generator, SSH keys in flight', () => {
  const PAIR = {
    privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nc2VjcmV0\n-----END OPENSSH PRIVATE KEY-----\n',
    publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI',
    fingerprint: 'SHA256:GeneratedFingerprint'
  }
  const FRESH = { ...PAIR, publicKey: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI me' }

  const openSsh = async () => {
    await open()
    await userEvent.click(screen.getByTestId('generator-mode-ssh'))
    return screen.findByTestId('generator-ssh-public')
  }

  it('refuses the old pair while a replacement is on its way', async () => {
    renderWithStore(<Harness />)
    await openSsh()

    let settle: (pair: typeof PAIR) => void = () => {}
    vi.mocked(generateSshKey).mockImplementationOnce(
      () => new Promise(resolve => (settle = resolve))
    )
    await userEvent.type(screen.getByTestId('generator-ssh-comment'), 'm')

    const save = screen.getByTestId('generator-use-button')
    expect(save).toBeDisabled()
    expect(screen.getByTestId('generator-ssh-key')).toHaveAttribute('aria-busy', 'true')
    await userEvent.keyboard('{Enter}')
    expect(useStore.getState().entries.new).toBeNull()
    expect(screen.getByTestId('generator-dialog')).toBeInTheDocument()

    settle(FRESH)
    await screen.findByText(FRESH.publicKey)
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(useStore.getState().entries.prefill).toEqual(FRESH)
  })

  it('shows a refused draw and offers to try again', async () => {
    renderWithStore(<Harness />)
    vi.mocked(generateSshKey).mockRejectedValueOnce(new Error('no entropy'))
    await open()
    await userEvent.click(screen.getByTestId('generator-mode-ssh'))

    await screen.findByTestId('generator-ssh-error')
    expect(screen.queryByTestId('generator-ssh-public')).not.toBeInTheDocument()
    expect(screen.getByTestId('generator-use-button')).toBeDisabled()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('generator-dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('generator-ssh-retry'))
    await screen.findByTestId('generator-ssh-public')
    expect(generateSshKey).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('generator-use-button')).toBeEnabled()
  })
})

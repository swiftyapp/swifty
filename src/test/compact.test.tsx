import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Main from '@/components/Main'
import AuthShell from '@/components/elements/AuthShell'
import Frame, { FrameProvider } from '@/components/elements/Frame'
import Sheet from '@/components/elements/Sheet'
import { revealEntry } from '@/lib/commands'
import {
  makeStore,
  useStore,
  openPalette,
  openSettings,
  openAddPicker,
  openGenerator
} from '@/store'
import { renderWithStore, withEntries, loginEntry, loginMeta } from './utils'
import { setLayout } from './layout'

const seed = () => {
  const store = makeStore()
  withEntries([loginMeta({ id: 'l1', title: 'Google' }), loginMeta({ id: 'l2', title: 'Airbnb' })])
  return store
}

beforeEach(() => {
  vi.clearAllMocks()
  setLayout('compact')
})

describe('compact shell', () => {
  it('replaces the rail with a tab bar and puts add and tags in the list header', () => {
    renderWithStore(<Main />, { store: seed() })

    expect(screen.getByTestId('compact-shell')).toBeInTheDocument()
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
    expect(screen.queryByTestId('view-items')).not.toBeInTheDocument()
    expect(screen.getByTestId('add-entry-button')).toBeInTheDocument()
    expect(screen.getByTestId('tags-button')).toBeInTheDocument()
  })

  it('pushes the detail screen on select and comes back from it', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ id: 'l1', title: 'Google' }))
    renderWithStore(<Main />, { store: seed() })

    expect(screen.getAllByTestId('entry-item')).toHaveLength(2)
    expect(screen.queryByTestId('compact-back')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Google'))
    expect(screen.getByRole('heading', { name: 'Google' })).toBeInTheDocument()
    // One screen at a time: the list and the tab bar are gone while it is up.
    expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tab-bar')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('compact-back'))
    expect(useStore.getState().entries.current).toBeNull()
    expect(screen.getAllByTestId('entry-item')).toHaveLength(2)
  })

  it('lands a new entry on the detail screen, without an unguarded way back', async () => {
    renderWithStore(<Main />, { store: seed() })

    await userEvent.click(screen.getByTestId('add-entry-button'))
    await userEvent.click(screen.getByTestId('add-kind-login'))

    expect(useStore.getState().entries.new).toBe('login')
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument()
    // Cancel/Discard in the editor is the only exit, so a draft cannot be
    // dropped by a stray tap on the bar.
    expect(screen.queryByTestId('compact-back')).not.toBeInTheDocument()
    expect(screen.getByTestId('cancel-entry-button')).toBeInTheDocument()
  })

  it('switches view from the tab bar', async () => {
    renderWithStore(<Main />, { store: seed() })

    await userEvent.click(screen.getByTestId('tab-favorites'))
    expect(useStore.getState().ui.view).toBe('favorites')
    expect(screen.getByTestId('list-title')).toHaveTextContent('Favorites')

    await userEvent.click(screen.getByTestId('tab-items'))
    expect(useStore.getState().ui.view).toBe('items')
  })

  it('carries four tabs and keeps the archive in settings', async () => {
    renderWithStore(<Main />, { store: seed() })

    expect(screen.getByTestId('tab-bar').querySelectorAll('button')).toHaveLength(4)
    expect(screen.queryByTestId('tab-archive')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('tab-settings'))
    await userEvent.click(screen.getByTestId('settings-archive'))

    expect(useStore.getState().ui.view).toBe('archive')
    expect(useStore.getState().ui.settings).toBe(false)
    expect(screen.getByTestId('list-title')).toHaveTextContent('Archive')
  })

  it('leaves the settings root when a list tab is tapped', async () => {
    renderWithStore(<Main />, { store: seed() })

    act(() => openSettings())
    expect(screen.queryByTestId('entry-item')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('tab-items'))
    expect(useStore.getState().ui.settings).toBe(false)
    expect(screen.getAllByTestId('entry-item')).toHaveLength(2)
  })

  it('opens the generator and settings from the tab bar', async () => {
    renderWithStore(<Main />, { store: seed() })

    await userEvent.click(screen.getByTestId('tab-generator'))
    expect(screen.getByTestId('generator-dialog')).toHaveAttribute('data-frame', 'sheet')
    expect(screen.getByTestId('tab-generator')).toHaveAttribute('aria-pressed', 'true')

    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByTestId('tab-settings'))
    expect(useStore.getState().ui.settings).toBe(true)
    // A root screen, with the bar still up: the tab bar is the way out of it.
    expect(screen.getByTestId('settings-nav-security')).toBeInTheDocument()
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument()
  })

  it('shows the empty-vault hero on the one pane it has', () => {
    const store = makeStore()
    withEntries([])
    renderWithStore(<Main />, { store })

    expect(screen.getAllByText('Your vault is empty')).toHaveLength(1)
  })

  it('leaves the command palette out', () => {
    renderWithStore(<Main />, { store: seed() })

    act(() => openPalette())
    expect(screen.queryByPlaceholderText('Run a command')).not.toBeInTheDocument()
  })
})

describe('overlay frames', () => {
  it('makes settings a screen on compact and the modal on wide', () => {
    const { unmount } = renderWithStore(<Main />, { store: seed() })
    act(() => openSettings())
    // A tab root rather than an overlay: no sheet over the list, and the
    // sections it navigates are in the shell itself.
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument()
    expect(screen.getByTestId('compact-shell')).toContainElement(
      screen.getByTestId('settings-nav-security')
    )
    unmount()

    setLayout('wide')
    renderWithStore(<Main />, { store: seed() })
    act(() => openSettings())
    expect(screen.getByTestId('settings-modal')).not.toHaveAttribute('data-frame')
  })

  it('gives the add picker a sheet on compact and the card on wide', () => {
    const { unmount } = renderWithStore(<Main />, { store: seed() })
    act(() => openAddPicker())
    expect(screen.getByTestId('add-secret-modal')).toHaveAttribute('data-frame', 'sheet')
    unmount()

    setLayout('wide')
    renderWithStore(<Main />, { store: seed() })
    act(() => openAddPicker())
    expect(screen.getByTestId('add-secret-modal')).not.toHaveAttribute('data-frame')
  })

  it('gives the generator a sheet on compact and the card on wide', () => {
    const { unmount } = renderWithStore(<Main />, { store: seed() })
    act(() => openGenerator())
    expect(screen.getByTestId('generator-dialog')).toHaveAttribute('data-frame', 'sheet')
    unmount()

    setLayout('wide')
    renderWithStore(<Main />, { store: seed() })
    act(() => openGenerator())
    const card = screen.getByTestId('generator-dialog')
    expect(card).not.toHaveAttribute('data-frame')
    // The e2e suite and `utils/dialogOpen` both read the card off the DOM.
    expect(card).toHaveAttribute('role', 'dialog')
    expect(card).toHaveAttribute('aria-labelledby', 'generator-title')
  })
})

// The frame a dialog gets is context, not a layout question it asks itself.
describe('Frame', () => {
  const dialog = (
    <Frame onClose={() => {}} testid="framed">
      <button type="button">inside</button>
    </Frame>
  )

  it('is the card by default and whatever the shell provides otherwise', () => {
    const { unmount } = render(dialog)
    expect(screen.getByTestId('framed')).not.toHaveAttribute('data-frame')
    unmount()

    render(<FrameProvider value={Sheet}>{dialog}</FrameProvider>)
    expect(screen.getByTestId('framed')).toHaveAttribute('data-frame', 'sheet')
  })
})

describe('AuthShell on compact', () => {
  it('renders its column and the back affordance', () => {
    const onBack = vi.fn()
    renderWithStore(
      <AuthShell onBack={onBack}>
        <div>Unlock</div>
      </AuthShell>
    )

    expect(screen.getByText('Unlock')).toBeInTheDocument()
    expect(screen.getByTestId('go-back-button')).toBeInTheDocument()
  })
})

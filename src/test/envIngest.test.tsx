import { useState } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldsProvider } from '@/components/elements/fields'
import type { DraftValue, EntryDraft } from '@/defaults/entries'
import { readEnvFile } from '@/lib/commands'
import Fields from '@/kinds/env/Fields'
import Main from '@/components/Main'
import { makeStore, useStore, startEntry, openAddPicker } from '@/store'
import { renderWithStore, withEntries, loginMeta } from './utils'

// The webview's drag-drop stream, replaced by a hand that can drop a file. The
// hook subscribes after a lazy import, so a test waits for the listener before
// it drops; `unlisten` takes it back out.
type Handler = (event: { payload: { type: string; paths: string[] } }) => void
let handlers: Handler[] = []
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: (handler: Handler) => {
      handlers.push(handler)
      return Promise.resolve(() => {
        handlers = handlers.filter(h => h !== handler)
      })
    }
  })
}))

const listening = () => waitFor(() => expect(handlers.length).toBeGreaterThan(0))

const drop = async (path: string) => {
  await listening()
  await act(async () => {
    for (const handler of [...handlers]) handler({ payload: { type: 'drop', paths: [path] } })
  })
}

const MINE = ['# Database', 'DATABASE_URL=postgres://mine', 'DB_POOL=10', ''].join('\n')
const THEIRS = ['DB_POOL=99', 'STRIPE_KEY=sk_live_1', ''].join('\n')
const FILE = { fileName: '.env.production', body: THEIRS }

const keyInputs = () =>
  Array.from(document.querySelectorAll<HTMLInputElement>('input[name^="env-key-"]')).map(
    el => el.value
  )

// Editing against a live draft, the way Show's editor holds one, with every
// write reported so the test can see the keys the zone set.
function Editor({
  body,
  title = '',
  onSet
}: {
  body: string
  title?: string
  onSet: (name: string, value: DraftValue) => void
}) {
  const [entry, setEntry] = useState<EntryDraft>({ type: 'env', title, body, fileName: '', note: '' })
  const set = (name: string, next: DraftValue) => {
    onSet(name, next)
    setEntry(prev => ({ ...prev, [name]: next }))
  }
  return (
    <FieldsProvider value={{ entry, set, attempted: false }}>
      <Fields />
    </FieldsProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  handlers = []
  vi.mocked(readEnvFile).mockResolvedValue(FILE)
})

describe('the editor drop zone', () => {
  it('is only there while editing', () => {
    render(
      <FieldsProvider
        value={{ entry: { type: 'env', title: 'x', body: MINE, note: '' }, set: null, attempted: false }}
      >
        <Fields />
      </FieldsProvider>
    )
    expect(screen.queryByTestId('env-dropzone')).not.toBeInTheDocument()
  })

  it('fills an empty draft with the file, its name and a proposed title', async () => {
    const onSet = vi.fn()
    render(<Editor body="" onSet={onSet} />)
    expect(screen.getByTestId('env-dropzone')).toHaveTextContent('Drop a .env file here')

    await drop('/Users/me/code/api/.env.production')

    await waitFor(() => expect(onSet).toHaveBeenCalledWith('body', THEIRS))
    expect(onSet).toHaveBeenCalledWith('fileName', '.env.production')
    expect(onSet).toHaveBeenCalledWith('title', 'api · production')
    expect(readEnvFile).toHaveBeenCalledWith('/Users/me/code/api/.env.production')
    expect(keyInputs()).toEqual(['DB_POOL', 'STRIPE_KEY'])
  })

  it('leaves a title that was already typed', async () => {
    const onSet = vi.fn()
    render(<Editor body="" title="Mine" onSet={onSet} />)

    await drop('/Users/me/code/api/.env')

    await waitFor(() => expect(onSet).toHaveBeenCalledWith('body', THEIRS))
    expect(onSet).not.toHaveBeenCalledWith('title', expect.anything())
  })

  it('asks before touching a draft that has variables, and replaces on request', async () => {
    const onSet = vi.fn()
    render(<Editor body={MINE} onSet={onSet} />)

    await drop('/Users/me/code/api/.env.production')

    const prompt = await screen.findByTestId('env-drop-prompt')
    expect(prompt).toHaveTextContent('.env.production')
    expect(onSet).not.toHaveBeenCalled()
    expect(keyInputs()).toEqual(['DATABASE_URL', 'DB_POOL'])

    await userEvent.click(screen.getByTestId('env-drop-replace'))

    expect(onSet).toHaveBeenCalledWith('body', THEIRS)
    expect(onSet).toHaveBeenCalledWith('fileName', '.env.production')
    expect(keyInputs()).toEqual(['DB_POOL', 'STRIPE_KEY'])
    expect(screen.queryByTestId('env-drop-prompt')).not.toBeInTheDocument()
  })

  it('merges only the new keys, leaving existing rows alone', async () => {
    const onSet = vi.fn()
    render(<Editor body={MINE} onSet={onSet} />)

    await drop('/Users/me/code/api/.env.production')
    await userEvent.click(await screen.findByTestId('env-drop-merge'))

    expect(onSet).toHaveBeenCalledWith('body', MINE + 'STRIPE_KEY=sk_live_1\n')
    expect(onSet).toHaveBeenCalledWith('fileName', '.env.production')
    expect(keyInputs()).toEqual(['DATABASE_URL', 'DB_POOL', 'STRIPE_KEY'])
    // The rotated value stays ours.
    expect(document.querySelector<HTMLTextAreaElement>('textarea[name="env-value-2"]')).toHaveValue(
      '10'
    )
  })

  it('can be told no, with the × or with Escape — which the editor never hears', async () => {
    const onSet = vi.fn()
    const heard = vi.fn()
    document.addEventListener('keydown', heard)
    render(<Editor body={MINE} onSet={onSet} />)

    await drop('/Users/me/code/api/.env.production')
    await userEvent.click(await screen.findByTestId('env-drop-cancel'))
    expect(screen.queryByTestId('env-drop-prompt')).not.toBeInTheDocument()

    await drop('/Users/me/code/api/.env.production')
    screen.getByTestId('env-drop-replace').focus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('env-drop-prompt')).not.toBeInTheDocument()

    expect(onSet).not.toHaveBeenCalled()
    expect(heard).not.toHaveBeenCalled()
    document.removeEventListener('keydown', heard)
  })

  it('shows why a file was refused', async () => {
    vi.mocked(readEnvFile).mockRejectedValue('file is larger than 1 MiB')
    const onSet = vi.fn()
    render(<Editor body="" onSet={onSet} />)

    await drop('/Users/me/huge.env')

    expect(await screen.findByTestId('env-drop-error')).toHaveTextContent('1 MiB')
    expect(onSet).not.toHaveBeenCalled()
  })
})

describe('a .env dropped on the idle window', () => {
  const seed = () => {
    const store = makeStore()
    withEntries([loginMeta({ id: 'l1', title: 'Google' })])
    return store
  }

  it('opens a new env draft with the file already in it', async () => {
    renderWithStore(<Main />, { store: seed() })

    await drop('/Users/me/code/api/.env.production')

    await waitFor(() => expect(useStore.getState().entries.new).toBe('env'))
    await waitFor(() => expect(keyInputs()).toEqual(['DB_POOL', 'STRIPE_KEY']))
    // Seeded through the same prefill a scan uses, and consumed the same way.
    expect(useStore.getState().entries.prefill).toBeNull()
    expect(document.querySelector('input[name="title"]')).toHaveValue('api · production')
  })

  it('takes a file that only reads like one', async () => {
    vi.mocked(readEnvFile).mockResolvedValue({ fileName: 'keys.txt', body: 'A=1\nB=2\n' })
    renderWithStore(<Main />, { store: seed() })

    await drop('/Users/me/keys.txt')

    await waitFor(() => expect(useStore.getState().entries.new).toBe('env'))
  })

  it('ignores anything that is neither named nor written like one', async () => {
    vi.mocked(readEnvFile).mockResolvedValue({ fileName: 'notes.txt', body: 'hello\nworld\n' })
    renderWithStore(<Main />, { store: seed() })

    await drop('/Users/me/notes.txt')
    await drop('/Users/me/card.png')

    expect(useStore.getState().entries.new).toBeNull()
    // The scanner's, so not even read.
    expect(readEnvFile).not.toHaveBeenCalledWith('/Users/me/card.png')
  })

  it('leaves an open editor alone', async () => {
    const store = seed()
    startEntry('login')
    renderWithStore(<Main />, { store })

    await drop('/Users/me/code/api/.env')

    expect(useStore.getState().entries.new).toBe('login')
    expect(readEnvFile).not.toHaveBeenCalled()
  })

  it('answers the Add picker and closes it', async () => {
    const store = seed()
    renderWithStore(<Main />, { store })
    act(() => openAddPicker())
    expect(screen.getByTestId('add-env-file')).toHaveTextContent('Drop a .env file')

    await drop('/Users/me/code/api/.env')

    await waitFor(() => expect(useStore.getState().entries.new).toBe('env'))
    expect(useStore.getState().ui.addPicker).toBe(false)
  })
})

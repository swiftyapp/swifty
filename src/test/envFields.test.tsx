import { useState } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldsProvider } from '@/components/elements/fields'
import type { DraftValue, EntryDraft } from '@/defaults/entries'
import { copy } from '@/services/copy'
import Fields from '@/kinds/env/Fields'
import { parseEnv, removeLine, setValue, varsOf } from '@/kinds/env/parse'

vi.mock('@/services/copy', () => ({ copy: vi.fn() }))

const BODY = [
  '# Database',
  'DATABASE_URL=postgres://x',
  'DB_POOL=10',
  '',
  '# Stripe',
  'STRIPE_KEY="sk_live_1"',
  'PORT=3000 # dev',
  ''
].join('\n')

// Past six variables the filter appears.
const LONG = [
  '# Database',
  'DATABASE_URL=postgres://x',
  'DB_POOL=10',
  '',
  '# Stripe',
  'STRIPE_KEY=sk_live_1',
  'STRIPE_WEBHOOK=whsec_1',
  '',
  'NODE_ENV=production',
  'PORT=3000',
  'HOST=0.0.0.0',
  'LOG_LEVEL=info',
  ''
].join('\n')

const DOTS = '•'.repeat(12)

const draft = (body: string): EntryDraft => ({ type: 'env', title: 'api · production', body, note: '' })

// The line index of a key, so no test hardcodes the parser's numbering.
const indexOf = (body: string, key: string) =>
  varsOf(parseEnv(body)).find(v => v.key === key)!.index

const value = (body: string, key: string) => screen.getByTestId(`env-value-${indexOf(body, key)}`)

const keyInput = (index: number | string) =>
  document.querySelector<HTMLInputElement>(`input[name="env-key-${index}"]`)
const valueBox = (index: number | string) =>
  document.querySelector<HTMLTextAreaElement>(`textarea[name="env-value-${index}"]`)

const renderRead = (body = BODY) =>
  render(
    <FieldsProvider value={{ entry: draft(body), set: null, attempted: false }}>
      <Fields />
    </FieldsProvider>
  )

// Editing against a live draft, the way Show's editor holds one: every write
// lands back in the entry the fields read from.
function Editor({
  body,
  onSet,
  attempted = false
}: {
  body: string
  onSet?: (name: string, value: DraftValue) => void
  attempted?: boolean
}) {
  const [entry, setEntry] = useState(draft(body))
  const set = (name: string, next: DraftValue) => {
    onSet?.(name, next)
    setEntry(prev => ({ ...prev, [name]: next }))
  }
  return (
    <FieldsProvider value={{ entry, set, attempted }}>
      <Fields />
    </FieldsProvider>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('Env fields, reading', () => {
  it('lays the file out as captioned bands with every value masked', () => {
    renderRead()

    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.getByText('4 variables')).toBeInTheDocument()
    for (const key of ['DATABASE_URL', 'DB_POOL', 'STRIPE_KEY', 'PORT']) {
      expect(screen.getByText(key)).toBeInTheDocument()
      expect(value(BODY, key)).toHaveTextContent(DOTS)
    }
    // Nothing secret is on screen.
    expect(document.body.textContent).not.toContain('sk_live_1')
  })

  it('reveals one value with its row eye and leaves the others masked', async () => {
    renderRead()
    await userEvent.click(screen.getByTestId(`reveal-env-${indexOf(BODY, 'STRIPE_KEY')}`))

    expect(value(BODY, 'STRIPE_KEY')).toHaveTextContent('sk_live_1')
    expect(value(BODY, 'DATABASE_URL')).toHaveTextContent(DOTS)
  })

  it('reveals every value with the panel eye', async () => {
    renderRead()
    await userEvent.click(screen.getByTestId('env-reveal-all'))

    expect(value(BODY, 'DATABASE_URL')).toHaveTextContent('postgres://x')
    expect(value(BODY, 'DB_POOL')).toHaveTextContent('10')
    expect(value(BODY, 'STRIPE_KEY')).toHaveTextContent('sk_live_1')
    expect(value(BODY, 'PORT')).toHaveTextContent('3000')
  })

  it('copies the true value when a masked value is pressed', async () => {
    renderRead()
    await userEvent.click(screen.getByLabelText('STRIPE_KEY · Copy'))

    expect(copy).toHaveBeenCalledWith('sk_live_1')
  })

  it('shows a trailing inline comment as a gloss after the value', () => {
    renderRead()
    expect(screen.getByText('· dev')).toBeInTheDocument()
  })

  it('shows the note in a panel of its own only when there is one', () => {
    const { unmount } = renderRead()
    expect(screen.queryByTestId('entry-value-note')).not.toBeInTheDocument()
    unmount()

    render(
      <FieldsProvider
        value={{ entry: { ...draft(BODY), note: 'rotate monthly' }, set: null, attempted: false }}
      >
        <Fields />
      </FieldsProvider>
    )
    expect(screen.getByTestId('entry-value-note')).toHaveTextContent('rotate monthly')
  })

  it('masks the whole file on the File tab until the eye is pressed', async () => {
    renderRead()
    await userEvent.click(screen.getByTestId('env-tab-file'))

    expect(screen.getByTestId('entry-value-body')).toHaveTextContent('•'.repeat(24))
    expect(screen.queryByTestId('env-reveal-all')).not.toBeInTheDocument()

    await userEvent.click(screen.getByTestId('reveal-body'))
    expect(screen.getByTestId('entry-value-body').textContent).toBe(BODY)
  })
})

describe('Env fields, filtering', () => {
  it('offers a filter only past six variables', () => {
    const { unmount } = renderRead()
    expect(screen.queryByTestId('env-filter')).not.toBeInTheDocument()
    unmount()

    renderRead(LONG)
    expect(screen.getByTestId('env-filter')).toBeInTheDocument()
  })

  it('narrows to the bands and keys that match, case-insensitively', async () => {
    renderRead(LONG)
    await userEvent.type(screen.getByTestId('env-filter'), 'stripe')

    // The caption matched, so the whole band stays.
    expect(screen.getByText('STRIPE_KEY')).toBeInTheDocument()
    expect(screen.getByText('STRIPE_WEBHOOK')).toBeInTheDocument()
    expect(screen.queryByText('Database')).not.toBeInTheDocument()
    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument()
    expect(screen.queryByText('PORT')).not.toBeInTheDocument()

    await userEvent.clear(screen.getByTestId('env-filter'))
    await userEvent.type(screen.getByTestId('env-filter'), 'port')
    // A key matched inside a band without a caption: only that row.
    expect(screen.getByText('PORT')).toBeInTheDocument()
    expect(screen.queryByText('HOST')).not.toBeInTheDocument()
  })

  // Values are masked; a filter that saw them would let anyone narrow a secret
  // down by typing prefixes at it.
  it('never matches a value', async () => {
    renderRead(LONG)
    await userEvent.type(screen.getByTestId('env-filter'), 'postgres')

    expect(screen.getByText('No variables match')).toBeInTheDocument()
    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument()
  })

  it('clears on Escape', async () => {
    renderRead(LONG)
    await userEvent.type(screen.getByTestId('env-filter'), 'stripe')
    expect(screen.queryByText('DATABASE_URL')).not.toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    expect(screen.getByTestId('env-filter')).toHaveValue('')
    expect(screen.getByText('DATABASE_URL')).toBeInTheDocument()
  })
})

describe('Env fields, editing', () => {
  it('rewrites just that line of the file when a value is typed', async () => {
    const onSet = vi.fn()
    render(<Editor body={BODY} onSet={onSet} />)
    const index = indexOf(BODY, 'DATABASE_URL')

    await userEvent.type(valueBox(index)!, 'x')

    expect(onSet).toHaveBeenCalledWith('body', setValue(BODY, index, 'postgres://xx'))
    // Everything else in the file is untouched.
    expect(valueBox(index)!.value).toBe('postgres://xx')
    expect(document.body.textContent).toContain('4 variables')
  })

  it('drops the line whose remove button is pressed', async () => {
    const onSet = vi.fn()
    render(<Editor body={BODY} onSet={onSet} />)
    const index = indexOf(BODY, 'DB_POOL')

    await userEvent.click(screen.getByTestId(`remove-env-${index}`))

    expect(onSet).toHaveBeenCalledWith('body', removeLine(BODY, index))
    expect(screen.queryByDisplayValue('DB_POOL')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('DATABASE_URL')).toBeInTheDocument()
  })

  it('warns on the later of two rows sharing a key', () => {
    render(<Editor body={'A=1\nA=2\nB=3\n'} />)

    expect(screen.getAllByText('Duplicate key')).toHaveLength(1)
  })

  it('complains about a new name that is not an identifier, and commits one that is', async () => {
    render(<Editor body={BODY} />)
    await userEvent.click(screen.getByTestId('add-env-var-0'))

    // The row is the editor's own until its key can be written into the file.
    expect(keyInput('new')).toHaveFocus()
    await userEvent.type(keyInput('new')!, '1x')
    expect(screen.getByText('Not a valid name')).toBeInTheDocument()
    expect(document.body.textContent).toContain('4 variables')

    await userEvent.clear(keyInput('new')!)
    await userEvent.type(keyInput('new')!, 'N')

    // Written at the end of the Database band, and the caret went with it.
    const added = indexOf(BODY, 'DB_POOL') + 1
    expect(keyInput('new')).toBeNull()
    expect(keyInput(added)).toHaveValue('N')
    expect(keyInput(added)).toHaveFocus()
    expect(document.body.textContent).toContain('5 variables')
  })

  it('says Required under an empty file once a save was attempted', () => {
    render(<Editor body="" attempted />)
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByTestId('add-env-var-0')).toBeInTheDocument()
  })

  it('adds a row on Enter in the value box of a band’s last row', async () => {
    render(<Editor body={BODY} />)

    await userEvent.type(valueBox(indexOf(BODY, 'DB_POOL'))!, '{Enter}')
    expect(keyInput('new')).toBeInTheDocument()

    // Not on the first row of a band, where Enter would only reorder things.
    await userEvent.click(screen.getByTestId('remove-env-new'))
    await userEvent.type(valueBox(indexOf(BODY, 'DATABASE_URL'))!, '{Enter}')
    expect(keyInput('new')).toBeNull()
  })

  it('inserts a pasted block of KEY=VALUE lines as rows after this one', async () => {
    render(<Editor body={BODY} />)
    const index = indexOf(BODY, 'DATABASE_URL')

    await userEvent.click(keyInput(index)!)
    await userEvent.paste('A=1\nB=2')

    // The key box did not take the text; the file gained two lines in order.
    expect(keyInput(index)).toHaveValue('DATABASE_URL')
    expect(keyInput(index + 1)).toHaveValue('A')
    expect(valueBox(index + 1)).toHaveValue('1')
    expect(keyInput(index + 2)).toHaveValue('B')
    expect(keyInput(index + 3)).toHaveValue('DB_POOL')
    expect(document.body.textContent).toContain('6 variables')
  })

  it('edits the raw file on the File tab', async () => {
    const onSet = vi.fn()
    render(<Editor body={BODY} onSet={onSet} />)
    await userEvent.click(screen.getByTestId('env-tab-file'))

    const box = document.querySelector<HTMLTextAreaElement>('textarea[name="body"]')!
    expect(box.value).toBe(BODY)
    await userEvent.type(box, 'X=1')
    expect(onSet).toHaveBeenLastCalledWith('body', `${BODY}X=1`)
  })
})

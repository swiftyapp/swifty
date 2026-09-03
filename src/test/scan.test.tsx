import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { open } from '@tauri-apps/plugin-dialog'
import Main from '@/components/Main'
import { scanImage } from '@/lib/commands'
import { makeStore, useStore, setScanSupported, startEntry } from '@/store'
import {
  cleanFields,
  firstImage,
  isImagePath,
  mergeFields
} from '@/components/Main/Scan/fields'
import { runScan } from '@/components/Main/Scan/run'
import { renderWithStore, withEntries, loginMeta } from './utils'

const CARD = { number: '4242424242424242', month: '04', year: '27', name: 'ADA LOVELACE' }

const PASSPORT = {
  doc_type: 'passport',
  name: 'ANNA MARIA ERIKSSON',
  number: 'L898902C3',
  country: 'UTO',
  nationality: 'UTO',
  birth_date: '1974-08-12',
  sex: 'F',
  expiry_date: '2012-04-15',
  personal_number: 'ZE184226B'
}

const seed = () => {
  const store = makeStore()
  withEntries([loginMeta({ id: 'l1', title: 'Google' })])
  return store
}

const scan = (path: string) => act(async () => void (await runScan(path)))

beforeEach(() => vi.clearAllMocks())

describe('scan fields', () => {
  it('takes only images, whatever the case of the extension', () => {
    expect(isImagePath('/Users/me/Desktop/card.png')).toBe(true)
    expect(isImagePath('/Users/me/IMG_0042.HEIC')).toBe(true)
    expect(isImagePath('shot.jpeg')).toBe(true)
    // What the Import drop zone is there for, and must keep getting.
    expect(isImagePath('/Users/me/export.csv')).toBe(false)
    expect(isImagePath('/Users/me/vault.swftx')).toBe(false)
    expect(isImagePath('/Users/me/scan.pdf')).toBe(false)
    // No extension at all — including a directory that only looks like one.
    expect(isImagePath('/Users/me/screenshot')).toBe(false)
    expect(isImagePath('/Users/me/photos.png/notes')).toBe(false)
  })

  it('picks the image out of a mixed drop', () => {
    expect(firstImage(['/a/readme.txt', '/a/card.jpg'])).toBe('/a/card.jpg')
    expect(firstImage(['/a/readme.txt', '/a/export.csv'])).toBeUndefined()
    expect(firstImage([])).toBeUndefined()
  })

  it('drops the fields the recognizer could not fill', () => {
    expect(cleanFields({ number: 'L898902C3', personal_number: '', sex: '   ' })).toEqual({
      number: 'L898902C3'
    })
  })

  it('fills only what is empty', () => {
    const draft = { type: 'card' as const, title: 'My card', number: '', name: 'MY OWN NAME' }

    expect(mergeFields(draft, CARD)).toEqual({
      type: 'card',
      title: 'My card',
      number: '4242424242424242',
      month: '04',
      year: '27',
      // Typed by hand, so the scan does not get to correct it.
      name: 'MY OWN NAME'
    })
  })

  it('always sets the document type', () => {
    const draft = { type: 'identity' as const, title: '', doc_type: 'passport', number: '' }

    // The default is not an answer: the document says what it is.
    expect(mergeFields(draft, { doc_type: 'id_card', number: 'X1' })).toMatchObject({
      doc_type: 'id_card',
      number: 'X1'
    })
  })

  it('leaves values that are not text alone', () => {
    const draft = { type: 'card' as const, title: '', tags: ['travel'] }

    expect(mergeFields(draft, { tags: 'ignored' }).tags).toEqual(['travel'])
  })
})

describe('scan routing', () => {
  it('starts a new entry of the kind that was recognized, seeded', async () => {
    seed()
    vi.mocked(scanImage).mockResolvedValue({ kind: 'card', fields: CARD })

    await scan('/Users/me/card.png')

    expect(useStore.getState().entries.new).toBe('card')
    expect(useStore.getState().entries.prefill).toEqual(CARD)
    expect(useStore.getState().ui.scan.busy).toBe(false)
  })

  it('fills the editor already open for that kind instead of opening another', async () => {
    seed()
    startEntry('identity')
    vi.mocked(scanImage).mockResolvedValue({ kind: 'identity', fields: PASSPORT })

    await scan('/Users/me/passport.jpg')

    expect(useStore.getState().entries.new).toBe('identity')
    expect(useStore.getState().entries.prefill).toEqual(PASSPORT)
  })

  it('reports why nothing came back', async () => {
    seed()
    vi.mocked(scanImage).mockRejectedValue('nothing recognized')

    await scan('/Users/me/wall.png')

    expect(useStore.getState().entries.new).toBeNull()
    expect(useStore.getState().ui.scan).toMatchObject({ busy: false, error: 'unreadable' })
  })
})

describe('a scanned draft', () => {
  it('opens the editor with the fields already in it', async () => {
    const store = seed()
    setScanSupported(true)
    vi.mocked(scanImage).mockResolvedValue({ kind: 'identity', fields: PASSPORT })
    renderWithStore(<Main />, { store })

    await scan('/Users/me/passport.jpg')

    await waitFor(() =>
      expect(document.querySelector('input[name="number"]')).toHaveValue('L898902C3')
    )
    expect(document.querySelector('input[name="name"]')).toHaveValue('ANNA MARIA ERIKSSON')
    // Consumed: nothing is left to seed the next entry with.
    expect(useStore.getState().entries.prefill).toBeNull()
  })

  it('fills the blanks of an editor that is already open', async () => {
    const store = seed()
    setScanSupported(true)
    startEntry('identity')
    renderWithStore(<Main />, { store })

    const name = document.querySelector('input[name="name"]') as HTMLInputElement
    await userEvent.type(name, 'MY OWN NAME')

    vi.mocked(scanImage).mockResolvedValue({ kind: 'identity', fields: PASSPORT })
    await scan('/Users/me/passport.jpg')

    await waitFor(() =>
      expect(document.querySelector('input[name="number"]')).toHaveValue('L898902C3')
    )
    expect(name).toHaveValue('MY OWN NAME')
  })
})

describe('scanning from the picker', () => {
  const openFromRail = () => userEvent.click(screen.getByTestId('add-entry-button'))

  it('offers nothing where the platform cannot scan', async () => {
    renderWithStore(<Main />, { store: seed() })
    await openFromRail()

    expect(screen.queryByTestId('add-scan-image')).not.toBeInTheDocument()
  })

  it('offers the action where it can', async () => {
    const store = seed()
    setScanSupported(true)
    renderWithStore(<Main />, { store })
    await openFromRail()

    const action = within(screen.getByTestId('add-secret-modal')).getByTestId('add-scan-image')
    expect(action).toHaveTextContent('Scan a card or document…')
  })

  it('routes a picked file like a drop', async () => {
    const store = seed()
    setScanSupported(true)
    vi.mocked(open).mockResolvedValue('/Users/me/card.png')
    vi.mocked(scanImage).mockResolvedValue({ kind: 'card', fields: CARD })
    renderWithStore(<Main />, { store })
    await openFromRail()

    await userEvent.click(screen.getByTestId('add-scan-image'))

    await waitFor(() => expect(useStore.getState().entries.new).toBe('card'))
    expect(useStore.getState().ui.addPicker).toBe(false)
    expect(vi.mocked(scanImage)).toHaveBeenCalledWith('/Users/me/card.png')
  })

  it('leaves the picker alone when the dialog is cancelled', async () => {
    const store = seed()
    setScanSupported(true)
    vi.mocked(open).mockResolvedValue(null)
    renderWithStore(<Main />, { store })
    await openFromRail()

    await userEvent.click(screen.getByTestId('add-scan-image'))

    expect(screen.getByTestId('add-secret-modal')).toBeInTheDocument()
    expect(vi.mocked(scanImage)).not.toHaveBeenCalled()
  })

  it('keeps the tiles answering to the digits', async () => {
    const store = seed()
    setScanSupported(true)
    renderWithStore(<Main />, { store })
    await openFromRail()

    await userEvent.keyboard('2')

    expect(useStore.getState().entries.new).toBe('card')
  })
})

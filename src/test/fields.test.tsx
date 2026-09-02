import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Show from '@/components/Main/Body/Aside/Show'
import { saveEntry, revealEntry, generateOtp, toEntryMeta } from '@/lib/commands'
import { renderWithStore, loginEntry, loginMeta } from './utils'

const input = (name: string) =>
  document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(saveEntry).mockImplementation(entry => Promise.resolve(toEntryMeta(entry)))
})

// One behaviour per type-aware field: the thing that field knows and a plain
// text box doesn't.
describe('Type-aware fields', () => {
  it('gives a URL the scheme the user left out', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('website'), 'example.com')
    // Normalization lands on blur, so the caret is never fighting the cursor.
    expect(input('website').value).toBe('example.com')

    await userEvent.tab()
    expect(input('website').value).toBe('https://example.com')
  })

  it('leaves a URL that already has a scheme alone', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('website'), 'http://intranet')
    await userEvent.tab()
    expect(input('website').value).toBe('http://intranet')
  })

  it('says so inline when an email is not one', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('email'), 'me@example')
    expect(screen.getByText('Not an email address')).toBeInTheDocument()

    await userEvent.type(input('email'), '.com')
    expect(screen.queryByText('Not an email address')).not.toBeInTheDocument()
  })

  it('groups a card number as it is typed and names the network', async () => {
    renderWithStore(<Show type="card" editing />)
    await userEvent.type(input('number'), '4111111111111111')

    expect(input('number').value).toBe('4111 1111 1111 1111')
    expect(screen.getByLabelText('visa')).toBeInTheDocument()
  })

  it('splits the one MM/YY box back into the month and year the vault stores', async () => {
    renderWithStore(<Show type="card" editing />)
    await userEvent.type(input('title'), 'Visa')
    await userEvent.type(input('number'), '4111111111111111')
    await userEvent.type(input('expiry'), '1230')
    await userEvent.type(input('cvc'), '123')

    expect(input('expiry').value).toBe('12/30')

    await userEvent.click(screen.getByText('Save'))
    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({ month: '12', year: '30' })
    )
  })

  it('takes an otpauth:// link and keeps only the secret inside it', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.click(input('otp'))
    await userEvent.paste('otpauth://totp/Acme:me@acme.io?secret=JBSWY3DPEHPK3PXP&issuer=Acme')
    await userEvent.tab()

    expect(input('otp').value).toBe('JBSWY3DPEHPK3PXP')
    expect(generateOtp).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP')
    expect(screen.queryByText('Not a one-time-password secret')).not.toBeInTheDocument()
  })

  it('refuses an OTP secret it cannot read', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('otp'), 'not-a-secret')

    expect(screen.getByText('Not a one-time-password secret')).toBeInTheDocument()
    expect(generateOtp).not.toHaveBeenCalled()
  })

  it('previews the live code for a secret that is already saved', async () => {
    vi.mocked(generateOtp).mockResolvedValue({ code: '123456', time: 25 })
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ otp: 'JBSWY3DPEHPK3PXP' }))
    renderWithStore(<Show entry={loginMeta()} editing />)

    await waitFor(() => expect(input('otp').value).toBe('JBSWY3DPEHPK3PXP'))
    expect(await screen.findByText('123 456')).toBeInTheDocument()
    expect(screen.getByText('refreshes in 25s')).toBeInTheDocument()
  })

  it('rates the password being typed and stamps when it changed', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('password'), 'correct horse battery staple')

    // The strength meter is debounced through a timeout.
    expect(await screen.findByText('Very strong')).toBeInTheDocument()
    expect(screen.getByText('changed just now')).toBeInTheDocument()
  })
})

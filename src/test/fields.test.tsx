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
  // Every editor input is reachable by the name the row shows, so a screen
  // reader (and a test) can name what it is typing into.
  it('names its inputs after their labels', () => {
    renderWithStore(<Show type="login" editing />)

    expect(screen.getByLabelText('Password')).toBe(input('password'))
    expect(screen.getByLabelText('Username')).toBe(input('username'))
    // The label is the translated one the row shows, not the draft key.
    expect(screen.getByLabelText('URL')).toBe(input('website'))
    expect(screen.getByLabelText('Email')).toBe(input('email'))
    expect(screen.getByLabelText('OTP')).toBe(input('otp'))
  })

  it('names a full-bleed note body, which has no label column', () => {
    renderWithStore(<Show type="note" editing />)

    expect(screen.getByLabelText('Note')).toBe(
      document.querySelector('textarea[name="note"]')
    )
  })

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

  it('refuses to save a login whose email is not one', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('title'), 'Acme')
    await userEvent.type(input('username'), 'octocat')
    await userEvent.type(input('password'), 'hunter2')
    await userEvent.type(input('email'), 'me@example')

    await userEvent.click(screen.getByText('Save'))

    expect(saveEntry).not.toHaveBeenCalled()
    expect(screen.getByText('Not an email address')).toBeInTheDocument()
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

  it('says so when only half of the MM/YY box has been typed', async () => {
    renderWithStore(<Show type="card" editing />)
    await userEvent.type(input('title'), 'Visa')
    await userEvent.type(input('number'), '4111111111111111')
    await userEvent.type(input('cvc'), '123')
    await userEvent.type(input('expiry'), '12')

    await userEvent.click(screen.getByText('Save'))

    // The box is not empty, so only the pair-aware check can complain — and
    // without it the refusal to save was silent.
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(saveEntry).not.toHaveBeenCalled()
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

  // A pre-redesign vault can hold something `otpSecret` cannot read. The
  // backend would reject it too, so there is no code to offer and no panel.
  it('shows no dial for a stored secret it cannot read', async () => {
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ otp: 'legacy-garbage' }))
    renderWithStore(<Show entry={loginMeta()} />)

    await waitFor(() => expect(screen.getByTestId('entry-value-username')).toBeInTheDocument())
    expect(screen.queryByText('Copy code')).not.toBeInTheDocument()
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

  // The draft is seeded from the reveal, so an editor offered before the reveal
  // lands takes typing it is about to throw away.
  it('offers no editor until an existing entry has been decrypted', async () => {
    let resolveReveal: (entry: ReturnType<typeof loginEntry>) => void = () => {}
    vi.mocked(revealEntry).mockReturnValue(
      new Promise(resolve => {
        resolveReveal = resolve
      })
    )
    renderWithStore(<Show entry={loginMeta()} editing />)

    expect(document.querySelector('input[name="title"]')).toBeNull()

    resolveReveal(loginEntry())
    await waitFor(() => expect(input('title').value).toBe('Google'))

    await userEvent.type(input('title'), '!')
    expect(input('title').value).toBe('Google!')
  })

  it('counts a recent rotation as a duration', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    vi.mocked(revealEntry).mockResolvedValue(
      loginEntry({ password_updated_at: threeHoursAgo })
    )
    renderWithStore(<Show entry={loginMeta()} editing />)

    expect(await screen.findByText('changed 3h ago')).toBeInTheDocument()
  })

  // Past a week the duration runs out; a date belongs in its own sentence and
  // not inside "changed ... ago".
  it('names the date once the rotation is older than a week', async () => {
    const longAgo = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString()
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password_updated_at: longAgo }))
    renderWithStore(<Show entry={loginMeta()} editing />)

    const stamp = await screen.findByText(/^changed /)
    expect(stamp.textContent).toMatch(/^changed on /)
  })

  it('rates the password being typed and stamps when it changed', async () => {
    renderWithStore(<Show type="login" editing />)
    await userEvent.type(input('title'), 'Acme')
    await userEvent.type(input('username'), 'octocat')
    await userEvent.type(input('password'), 'correct horse battery staple')

    // The strength meter is debounced through a timeout.
    expect(await screen.findByText('Very strong')).toBeInTheDocument()
    // The stamp belongs to the saved password, so it lands on Save.
    expect(screen.queryByText('changed just now')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Save'))
    expect(screen.getByText('changed just now')).toBeInTheDocument()
  })

  it('leaves the rotation stamp alone when the password ends up unchanged', async () => {
    const stamp = '2024-01-01T00:00:00.000Z'
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password_updated_at: stamp }))
    renderWithStore(<Show entry={loginMeta()} editing />)

    await waitFor(() => expect(input('password').value).toBe('secret'))
    // Typed and taken back: the password never moved.
    await userEvent.type(input('password'), 'x')
    await userEvent.type(input('password'), '{backspace}')

    await userEvent.click(screen.getByText('Save'))
    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'secret', password_updated_at: stamp })
    )
  })

  it('moves the rotation stamp when the password really changed', async () => {
    const stamp = '2024-01-01T00:00:00.000Z'
    vi.mocked(revealEntry).mockResolvedValue(loginEntry({ password_updated_at: stamp }))
    renderWithStore(<Show entry={loginMeta()} editing />)

    await waitFor(() => expect(input('password').value).toBe('secret'))
    await userEvent.type(input('password'), '2')

    await userEvent.click(screen.getByText('Save'))
    expect(saveEntry).toHaveBeenCalledWith(expect.objectContaining({ password: 'secret2' }))
    expect(saveEntry).not.toHaveBeenCalledWith(
      expect.objectContaining({ password_updated_at: stamp })
    )
  })
})

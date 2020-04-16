describe('Application first launch', () => {
  beforeAll(async () => await before({ storage: 'pristine' }))

  afterAll(async () => await after())

  it('shows new user section', async () => {
    expect(await app.client.getText('.top-lock h2')).toBe('I am a new User')
  })

  it('shows new user button', async () => {
    expect(await app.client.getText('.top-lock .button')).toBe(
      'Setup Master Password'
    )
  })

  it('shows restore backup section', async () => {
    expect(await app.client.getText('.bottom-lock h2')).toBe(
      'I am existing User'
    )
  })

  it('shows restore button', async () => {
    expect(await app.client.getText('.bottom-lock .button')).toBe(
      'Restore from Backup'
    )
  })
})

describe('Application first launch', () => {
  beforeEach(async () => await before({ storage: 'pristine' }))

  afterEach(async () => await after())

  it('shows new user section', async () => {
    const topHeader = await app.client.$('.top-lock h2')
    const topButton = await app.client.$('.top-lock .button')
    const bottomHeader = await app.client.$('.bottom-lock h2')
    const bottomButton = await app.client.$('.bottom-lock .button')

    expect(await topHeader.getText()).toBe('I am a new User')
    expect(await topButton.getText()).toBe('Setup Master Password')
    expect(await bottomHeader.getText()).toBe('I am existing User')
    expect(await bottomButton.getText()).toBe('Restore from Backup')
  })
})

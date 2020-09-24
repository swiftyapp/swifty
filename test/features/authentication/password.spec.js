describe('Authentication with master password', () => {
  beforeEach(async () => await before({ storage: 'empty' }))

  afterEach(async () => await after())

  it('shows invalid password error', async () => {
    const input = await app.client.$('input[type=password]')
    await input.setValue('word')
    await input.keys('\uE007')
    const errorMessage = await app.client.$('.error-message')
    expect(await errorMessage.getText()).toBe('Incorrect Master Password')
  })

  it('logs user in on correct password', async () => {
    const input = await app.client.$('input[type=password]')
    await input.setValue('password')
    await input.keys('\uE007')
    const syncIndicator = await app.client.$('.sync-indicator')
    expect(await syncIndicator.isExisting()).toBe(true)
  })
})

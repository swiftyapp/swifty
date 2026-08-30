import { login } from 'helpers/login'
describe('Authentication with master password', () => {
  beforeEach(async () => await before({ storage: 'empty' }))

  afterEach(async () => await after())

  it('shows invalid password error', async () => {
    await login(app, 'word')

    const errorMessage = await app.client.$('.error-message')
    expect(await errorMessage.getText()).toBe('Incorrect Master Password')
  })

  it('logs user in on correct password', async () => {
    await login(app)

    const syncIndicator = await app.client.$('.sync-indicator')
    expect(await syncIndicator.isExisting()).toBe(true)
  })
})

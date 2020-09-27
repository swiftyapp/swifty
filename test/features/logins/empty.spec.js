import { login } from 'helpers/login'

describe('Empty entries list', () => {
  beforeAll(async () => await before({ storage: 'empty' }))

  afterAll(async () => await after())

  it('shows empty entries list', async () => {
    await login(app)

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe('No Items')

    const aside = await app.client.$('.aside .empty')
    expect(await aside.getText()).toBe(
      'Swifty\nKeep your passwords safe and organized\nCreate First Entry\nor\nImport from Gdrive'
    )
  })
})

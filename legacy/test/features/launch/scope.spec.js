import { login } from 'helpers/login'

describe('Scope switching', () => {
  beforeAll(async () => await before({ storage: 'example' }))

  afterAll(async () => await after())

  it('shows 3 scopes', async () => {
    await login(app)

    await app.client.$('.switcher .tooltip-context:nth-child(1) .item.current')

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe('Example\nmyuser')

    const notesButton = await app.client.$(
      '.switcher .tooltip-context:nth-child(2)'
    )
    await notesButton.click()

    const cardsButton = await app.client.$(
      '.switcher .tooltip-context:nth-child(3)'
    )
    await cardsButton.click()

    expect(await list.getText()).toBe('No Items')

    const loginsButton = await app.client.$(
      '.switcher .tooltip-context:nth-child(1)'
    )
    await loginsButton.click()
    expect(await list.getText()).toBe('Example\nmyuser')
  })
})

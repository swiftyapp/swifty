import { login } from 'helpers/login'
import { setValue } from 'helpers/form'

describe('Search credential entries', () => {
  beforeAll(async () => await before({ storage: 'collection' }))

  afterAll(async () => await after())

  it('shows credentials', async () => {
    await login(app)

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe(
      'Facebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
    )

    await setValue(app, 'search', 'in')
    expect(await list.getText()).toBe('Instagram\nanotheruser')

    await app.client.keys('\uE003')
    await app.client.keys('\uE003')

    expect(await list.getText()).toBe(
      'Facebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
    )
  })
})

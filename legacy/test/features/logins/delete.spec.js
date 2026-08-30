import { login } from 'helpers/login'

describe('Delete credentials entry', () => {
  beforeAll(async () => await before({ storage: 'example' }))

  afterAll(async () => await after())

  it('deletes credentials entry', async () => {
    await login(app)

    const entry = await app.client.$('.list .entry')
    await entry.click()

    const details = await app.client.$('.entry-details')
    expect(await details.getText()).toBe(
      `Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`
    )
    const deleteButton = await app.client.$(
      '.entry-title .action:nth-of-type(2)'
    )
    await deleteButton.click()

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe('No Items')
  })
})

import { login } from 'helpers/login'

describe('Empty tag filter', () => {
  beforeAll(async () => await before({ storage: 'collection' }))

  afterAll(async () => await after())

  it('shows tag filter toggle and empty state for tags', async () => {
    await login(app)

    const tagIcon = await app.client.$('.tag-icon')
    await tagIcon.click()

    const dropdown = await app.client.$('.tag-filter .dropdown')
    expect(await dropdown.getText()).toBe(
      'Start tagging your entries\nto filter them by tags.'
    )
  })
})

import { login } from 'helpers/login'

describe('Empty tag filter', () => {
  beforeEach(async () => await before({ storage: 'collection' }))

  beforeEach(async () => await after())

  it.skip('shows tag filter toggle and empty state for tags', async () => {
    await login(app)

    const tagIcon = await app.client.$('.tag-icon')
    expect(await tagIcon.isExisting()).toBe(true)

    await tagIcon.click()
    const dropdown = await app.client.$('.tag-filter .dropdown')

    expect(await dropdown.getText()).toBe(
      'Start tagging your entries\nto filter them by tags.'
    )
  })
})

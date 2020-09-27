import { login } from 'helpers/login'

describe('Empty tag filter', () => {
  beforeAll(async () => await before({ storage: 'tagged' }))

  afterAll(async () => await after())

  it('shows tag filter toggle and empty state for tags', async () => {
    await login(app)

    const list = await app.client.$('.list')
    expect(await list.getText()).toBe(
      'Facebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
    )

    const tagIcon = await app.client.$('.tag-icon')
    await tagIcon.click()

    const dropdown = await app.client.$('.tag-filter .dropdown')
    expect(await dropdown.getText()).toBe('personal\nwork\ntest')

    const tag1 = await app.client.$(
      '.tag-filter .dropdown .dropdown-item:first-child'
    )
    await tag1.click()

    expect(await list.getText()).toBe('Facebook\nmyuser')

    const selectedTag = await app.client.$('.tag-filter .tag-selected')
    expect(await selectedTag.getText()).toBe('personalx')

    const clearTags = await app.client.$('.tag-selected .tag-clear')
    await clearTags.click()

    const tagFilter = await app.client.$('.tag-filter')
    expect(await tagFilter.getText()).toBe('')

    await tagIcon.click()
    const tag2 = await app.client.$(
      '.tag-filter .dropdown .dropdown-item:nth-child(2)'
    )
    await tag2.click()

    expect(await list.getText()).toBe(
      'Google\nsomeuser\nInstagram\nanotheruser'
    )

    await tagIcon.click()

    const tag3 = await app.client.$(
      '.tag-filter .dropdown .dropdown-item:nth-child(3)'
    )
    await tag3.click()

    expect(await selectedTag.getText()).toBe('testx')

    expect(await list.getText()).toBe('Instagram\nanotheruser')
  })
})

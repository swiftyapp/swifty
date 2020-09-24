import { login } from 'helpers/login'

describe('Filter entries by tag', () => {
  beforeEach(async () => await before({ storage: 'tagged' }))

  afterEach(async () => await after())

  it.skip('shows all credentials', async () => {
    await login(app)

    const entry1 = await app.client.$('.list .entry:nth-child(1)')
    const entry2 = await app.client.$('.list .entry:nth-child(2)')
    const entry3 = await app.client.$('.list .entry:nth-child(3)')

    expect(await entry3.isExisting()).toBe(true)

    const tagIcon = await app.client.$('.tag-icon')
    await tagIcon.click()

    const dropdown = await app.client.$('.tag-filter .dropdown')
    expect(await dropdown.getText()).toBe('personal\nwork\ntest')

    const tag1 = await app.client.$(
      '.tag-filter .dropdown .dropdown-item:first-child'
    )
    await tag1.click()

    expect(await entry1.isExisting()).toBe(true)
    expect(await entry2.isExisting()).toBe(false)
  })

  // it('displays tags dropdown', async () => {
  //   const tagIcon = await app.client.$('.tag-icon')
  //   await tagIcon.click()
  //   const dropdown = await app.client.$('.tag-filter .dropdown')
  //   expect(await dropdown.getText()).toBe('personal\nwork\ntest')
  // })

  // it('filters entries by tag', async () => {
  //   expect(
  //     await app.client
  //       .click('.tag-filter .dropdown .dropdown-item:first-child')
  //       .isExisting('.list .entry:nth-child(2)')
  //   ).toBe(false)
  // })

  // it('displays only matching entry', async () => {
  //   expect(await app.client.getText('.list .entry')).toBe('Facebook\nmyuser')
  // })

  // it('shows selected tag', async () => {
  //   expect(await app.client.getText('.tag-filter .tag-selected')).toBe(
  //     'personalx'
  //   )
  // })

  // it('unfilters entries on clear tag', async () => {
  //   expect(
  //     await app.client
  //       .click('.tag-selected .tag-clear')
  //       .isExisting('.list .entry:nth-child(3)')
  //   ).toBe(true)
  // })

  // it('removes selected tag on clear', async () => {
  //   expect(await app.client.isExisting('.tag-filter .tag-selected')).toBe(false)
  // })

  // it('filters entries by another tag', async () => {
  //   expect(
  //     await app.client
  //       .click('.tag-icon')
  //       .click('.tag-filter .dropdown .dropdown-item:nth-child(2)')
  //       .isExisting('.list .entry:nth-child(2)')
  //   ).toBe(true)
  // })

  // it('shows first matching entry', async () => {
  //   expect(await app.client.getText('.list .entry:nth-child(1)')).toBe(
  //     'Google\nsomeuser'
  //   )
  // })

  // it('shows second matching entry', async () => {
  //   expect(await app.client.getText('.list .entry:nth-child(2)')).toBe(
  //     'Instagram\nanotheruser'
  //   )
  // })

  // it('replaces currently selected tag', async () => {
  //   expect(
  //     await app.client
  //       .click('.tag-icon')
  //       .click('.tag-filter .dropdown .dropdown-item:nth-child(3)')
  //       .getText('.tag-filter .tag-selected')
  //   ).toBe('testx')
  // })

  // it('filters mathing entries', async () => {
  //   expect(await app.client.getText('.list .entry:nth-child(1)')).toBe(
  //     'Instagram\nanotheruser'
  //   )
  // })

  // it('shows no other entries', async () => {
  //   expect(await app.client.isExisting('.list .entry:nth-child(2)')).toBe(false)
  // })
})

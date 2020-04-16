describe('Filter entries by tag', () => {
  describe('user filters credentials', () => {
    beforeAll(async () => await before({ storage: 'tagged' }))

    afterAll(async () => await after())

    it('shows all credentials', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .isExisting('.list .entry:nth-child(3)')
      ).toBe(true)
    })

    it('displays tags dropdown', async () => {
      expect(
        await app.client.click('.tag-icon').getText('.tag-filter .dropdown')
      ).toBe('personal\nwork\ntest')
    })

    it('filters entries by tag', async () => {
      expect(
        await app.client
          .click('.tag-filter .dropdown .dropdown-item:first-child')
          .isExisting('.list .entry:nth-child(2)')
      ).toBe(false)
    })

    it('displays only matching entry', async () => {
      expect(await app.client.getText('.list .entry')).toBe('Facebook\nmyuser')
    })

    it('shows selected tag', async () => {
      expect(await app.client.getText('.tag-filter .tag-selected')).toBe(
        'personalx'
      )
    })

    it('unfilters entries on clear tag', async () => {
      expect(
        await app.client
          .click('.tag-selected .tag-clear')
          .isExisting('.list .entry:nth-child(3)')
      ).toBe(true)
    })

    it('removes selected tag on clear', async () => {
      expect(await app.client.isExisting('.tag-filter .tag-selected')).toBe(
        false
      )
    })

    it('filters entries by another tag', async () => {
      expect(
        await app.client
          .click('.tag-icon')
          .click('.tag-filter .dropdown .dropdown-item:nth-child(2)')
          .isExisting('.list .entry:nth-child(2)')
      ).toBe(true)
    })

    it('shows first matching entry', async () => {
      expect(await app.client.getText('.list .entry:nth-child(1)')).toBe(
        'Google\nsomeuser'
      )
    })

    it('shows second matching entry', async () => {
      expect(await app.client.getText('.list .entry:nth-child(2)')).toBe(
        'Instagram\nanotheruser'
      )
    })

    it('replaces currently selected tag', async () => {
      expect(
        await app.client
          .click('.tag-icon')
          .click('.tag-filter .dropdown .dropdown-item:nth-child(3)')
          .getText('.tag-filter .tag-selected')
      ).toBe('testx')
    })

    it('filters mathing entries', async () => {
      expect(await app.client.getText('.list .entry:nth-child(1)')).toBe(
        'Instagram\nanotheruser'
      )
    })

    it('shows no other entries', async () => {
      expect(await app.client.isExisting('.list .entry:nth-child(2)')).toBe(
        false
      )
    })
  })
})

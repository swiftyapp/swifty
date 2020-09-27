describe.skip('Search credential entries', () => {
  describe('user searches credentials', () => {
    beforeAll(async () => await before({ storage: 'collection' }))

    afterAll(async () => await after())

    it('shows credentials', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .isExisting('.list .entry:nth-child(3)')
      ).toBe(true)
    })

    it('filters entries', async () => {
      expect(
        await app.client
          .setValue('.search input', 'in')
          .isExisting('.list .entry:nth-child(2)')
      ).toBe(false)
    })

    it('shows only matching entries', async () => {
      expect(
        await app.client
          .setValue('.search input', 'in')
          .getText('.list .entry:nth-child(1)')
      ).toBe('Instagram\nanotheruser')
    })

    it('adds entries back on clear filter', async () => {
      expect(
        await app.client
          .keys('\uE003')
          .keys('\uE003')
          .isExisting('.list .entry:nth-child(3)')
      ).toBe(true)
    })
  })
})

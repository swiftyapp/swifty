describe('Empty tag filter', () => {
  describe('user sees empty state for tags', () => {
    beforeAll(async () => await before({ storage: 'collection' }))

    afterAll(async () => await after())

    it('shows an initial window', async () => {
      const count = await app.client.getWindowCount()
      expect(count).toBe(1)
    })

    it('shows tag filter toggle', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .isExisting('.tag-icon')
      ).toBe(true)
    })

    it('displays empty state for tags', async () => {
      expect(
        await app.client.click('.tag-icon').getText('.tag-filter .dropdown')
      ).toBe('Start tagging your entries\nto filter them by tags.')
    })
  })
})

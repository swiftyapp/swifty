describe('Scope switching', () => {
  describe('user launches application', () => {
    beforeAll(async () => await before({ storage: 'example' }))

    afterAll(async () => await after())

    it('shows 3 scopes', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.sidebar')
          .isExisting('.switcher .tooltip-context:nth-child(3)')
      ).toBe(true)
    })

    it('highlights logins scope as current', async () => {
      expect(
        await app.client.isExisting(
          '.switcher .tooltip-context:nth-child(1) .item.current'
        )
      ).toBe(true)
    })

    it('displays entries for given scope', async () => {
      expect(await app.client.getText('.body .list .entry')).toBe(
        'Example\nmyuser'
      )
    })

    it('switches scope to notes', async () => {
      expect(
        await app.client
          .click('.switcher .tooltip-context:nth-child(2)')
          .isExisting('.switcher .tooltip-context:nth-child(2) .item.current')
      ).toBe(true)
    })

    it('displays entries for given scope', async () => {
      expect(await app.client.getText('.body .list')).toBe('No Items')
    })

    it('switches scope to cards', async () => {
      expect(
        await app.client
          .click('.switcher .tooltip-context:nth-child(3)')
          .isExisting('.switcher .tooltip-context:nth-child(3) .item.current')
      ).toBe(true)
    })

    it('displays entries for given scope', async () => {
      expect(await app.client.getText('.body .list')).toBe('No Items')
    })

    it('switches scope back to logins', async () => {
      expect(
        await app.client
          .click('.switcher .tooltip-context:nth-child(1)')
          .isExisting('.switcher .tooltip-context:nth-child(1) .item.current')
      ).toBe(true)
    })

    it('displays entries for given scope', async () => {
      expect(await app.client.getText('.body .list')).toBe('Example\nmyuser')
    })
  })
})

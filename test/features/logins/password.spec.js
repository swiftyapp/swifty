describe.skip('Password field on entry form', () => {
  describe('show/hide password', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows credentials form', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .click('.add-button')
          .isExisting('input[name=password]')
      ).toBe(true)
    })

    it('password is hidden by defaul', async () => {
      expect(
        await app.client
          .setValue('input[name=password]', 'password')
          .isExisting('.secure-on input[name=password]')
      ).toBe(true)
    })

    it('shows password on click reveal', async () => {
      expect(
        await app.client
          .click('.secure-on .view')
          .isExisting('.secure-off input[name=password]')
      ).toBe(true)
    })

    it('shows password on click reveal', async () => {
      expect(await app.client.getValue('input[name=password]')).toBe('password')
    })

    it('generates password', async () => {
      expect(
        await app.client
          .click('.secure-off .action')
          .getValue('input[name=password]')
      ).not.toBe('password')
    })

    it('replaces current password', async () => {
      const value = await app.client.getValue('input[name=password]')
      expect(value.length).toBe(12)
    })
  })
})

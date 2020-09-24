describe.skip('Empty entries list', () => {
  describe('user loads main application window', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows empty entries list', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .getText('.body .list')
      ).toBe('No Items')
    })

    it('shows empty state for item form', async () => {
      expect(await app.client.getText('.aside .empty')).toBe(
        'Swifty\nKeep your passwords safe and organized\nCreate First Entry\nor\nImport from Gdrive'
      )
    })
  })
})

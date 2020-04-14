describe('Vault settings', () => {
  describe('User opens vault settings', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows vault settings', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .click('.settings-button')
          .getText('.body h1')
      ).toBe('Vault Settings')
    })

    it('contains connect to google drive button', async () => {
      expect(await app.client.getText('.section:nth-of-type(1) .button')).toBe(
        'Connect your Google Drive'
      )
    })

    it('contains save vault file button', async () => {
      expect(await app.client.getText('.section:nth-of-type(2) .button')).toBe(
        'Save Vault File'
      )
    })
  })
})

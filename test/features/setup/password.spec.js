describe('Setting up master password', () => {
  describe('user password setup', () => {
    beforeEach(() => before({ storage: 'pristine' }))

    afterEach(() => after())

    it('shows non-matching password error', async () => {
      expect(
        await app.client
          .click('.top-lock .button')
          .setValue('input[type=password]', 'password')
          .click('.button')
          .setValue('input[type=password]', 'pass')
          .click('.button')
          .getText('.error-message')
      ).toBe('Passwords do not match')
    })

    it('shows app main window on password match', async () => {
      expect(
        await app.client
          .click('.top-lock .button')
          .setValue('input[type=password]', 'password')
          .click('.button')
          .setValue('input[type=password]', 'password')
          .click('.button')
          .isExisting('.sync-indicator')
      ).toBe(true)
    })
  })
})

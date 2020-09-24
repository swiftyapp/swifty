describe('Setting up master password', () => {
  describe('user password setup', () => {
    beforeEach(() => before({ storage: 'pristine' }))

    afterEach(() => after())

    it('shows non-matching password error', async () => {
      const button = await app.client.$('.top-lock .button')
      await button.click()

      const input = await app.client.$('input[type=password]')
      await input.setValue('password')

      const nextButton = await app.client.$('.button')
      await nextButton.click()

      await input.setValue('pass')
      await nextButton.click()

      const errorMessage = await app.client.$('.error-message')
      expect(await errorMessage.getText()).toBe('Passwords do not match')
    })

    it('shows app main window on password match', async () => {
      const button = await app.client.$('.top-lock .button')
      await button.click()

      const input = await app.client.$('input[type=password]')
      await input.setValue('password')

      const nextButton = await app.client.$('.button')
      await nextButton.click()

      await input.setValue('password')
      await nextButton.click()

      const syncIndicator = await app.client.$('.sync-indicator')

      expect(await syncIndicator.isExisting()).toBe(true)
    })
  })
})

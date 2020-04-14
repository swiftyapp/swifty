describe('Authentication with master password', () => {
  describe('user enters password', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows invalid password error', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'word')
          .keys('\uE007')
          .getText('.error-message')
      ).toBe('Incorrect Master Password')
    })

    it('does not show touch id icon', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'word')
          .keys('\uE007')
          .isExisting('svg.touchid')
      ).toBe(false)
    })

    it('logs user in on correct password', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .isExisting('.sync-indicator')
      ).toBe(true)
    })
  })
})

describe('Password generation settings', () => {
  describe('User opens password settings', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows password settings', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .click('.settings-button')
          .click('.window .navigation li:nth-child(3)')
          .getText('.body h1')
      ).toBe('Password Settings')
    })

    it('contains password preview', async () => {
      expect(
        await app.client.isExisting('.section:nth-of-type(1) .password-sample')
      ).toBe(true)
    })

    it('password preview of default length', async () => {
      expect(
        await app.client
          .getText('.section:nth-of-type(1) .password-sample')
          .then(value => value.length)
      ).toBe(12)
    })

    it('changes password preview length', async () => {
      expect(
        await app.client
          .isExisting('.section:nth-of-type(2) input[type=range]')
          .setValue('.section:nth-of-type(2) input[type=range]', 28)
          .getText('.section:nth-of-type(1) .password-sample')
          .then(value => value.length)
      ).toBe(28)
    })

    it('contains numbers checkbox', async () => {
      expect(
        await app.client.isExisting(
          '.section:nth-of-type(3) input[name=numbers]'
        )
      ).toBe(true)
    })

    it('contains uppercase checkbox', async () => {
      expect(
        await app.client.isExisting(
          '.section:nth-of-type(3) input[name=uppercase]'
        )
      ).toBe(true)
    })

    it('contains special symbols checkbox', async () => {
      expect(
        await app.client.isExisting(
          '.section:nth-of-type(3) input[name=symbols]'
        )
      ).toBe(true)
    })
  })
})

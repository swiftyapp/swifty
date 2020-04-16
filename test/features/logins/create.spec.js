describe('Create credentials entry', () => {
  describe('user createst credentials entry', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows credentials form', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .empty')
          .click('.add-button')
          .getText('.aside .actions')
      ).toBe('CancelSave')
    })

    it('shows validation errors', async () => {
      expect(
        await app.client
          .click('.aside .actions .button')
          .isExisting('.field.error:nth-of-type(3)')
      ).toBe(true)
    })

    it('cancels entry creation', async () => {
      expect(
        await app.client
          .setValue('input[name=title]', 'Example')
          .click('.aside .actions .cancel')
          .isExisting('.list .entry')
      ).toBe(false)
    })

    it('hides creation form', async () => {
      expect(await app.client.isExisting('.aside .empty')).toBe(true)
    })

    it('opens creation form again', async () => {
      expect(
        await app.client
          .click('.add-button')
          .waitForExist('input[name=title]')
          .getValue('input[name=title]')
      ).toBe('')
    })

    it('creates credentials entry', async () => {
      expect(
        await app.client
          .setValue('input[name=title]', 'Example')
          .setValue('input[name=website]', 'https://example.com')
          .setValue('input[name=username]', 'myuser')
          .setValue('input[name=password]', 'mypassword')
          .click('.aside .actions .button')
          .getText('.body .list')
      ).toBe('Example\nmyuser')
    })

    it('displays show view instead of form', async () => {
      expect(
        await app.client
          .waitForExist('.entry-details')
          .getText('.entry-details')
      ).toBe(
        `Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`
      )
    })
  })
})

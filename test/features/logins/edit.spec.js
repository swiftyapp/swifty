describe('Edit credential entry', () => {
  describe('user edits credentials entry', () => {
    beforeAll(async () => await before({ storage: 'example' }))

    afterAll(async () => await after())

    it('shows credentials view', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .click('.list .entry')
          .getText('.entry-details')
      ).toBe(
        `Website\nhttps://example.com\nUsername\nmyuser\nPassword\nmypassword`
      )
    })

    it('shows edit form', async () => {
      expect(
        await app.client
          .click('.entry-title .action:nth-of-type(1)')
          .getText('.aside .actions')
      ).toBe('CancelSave')
    })

    it('cancels update', async () => {
      expect(
        await app.client
          .setValue('input[name=title]', 'Example Updated')
          .click('.actions .cancel')
          .getText('.list .entry')
      ).toBe('Example\nmyuser')
    })

    it('hides edit form', async () => {
      expect(await app.client.getText('.entry-title h1')).toBe('Example')
    })

    it('shows editor form again', async () => {
      expect(
        await app.client
          .click('.entry-title .action:nth-of-type(1)')
          .waitForExist('input[name=title]')
          .getValue('input[name=title]')
      ).toBe('Example')
    })

    it('updates credential entry', async () => {
      expect(
        await app.client
          .setValue('input[name=title]', 'Example Updated')
          .click('.actions .button')
          .getText('.list .entry')
      ).toBe('Example Updated\nmyuser')
    })

    it('displays show view in a sidebar', async () => {
      expect(await app.client.getText('.entry-title h1')).toBe(
        'Example Updated'
      )
    })
  })
})

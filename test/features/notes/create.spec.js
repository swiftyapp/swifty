describe('Create note entry', () => {
  describe('user creates note entry', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows credentials view', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .getText('.body .list')
      ).toBe('No Items')
    })

    it('switches to note scope', async () => {
      expect(
        await app.client
          .click('.switcher .tooltip-context:nth-child(2)')
          .getText('.body .list')
      ).toBe('No Items')
    })

    it('shows add note form', async () => {
      expect(
        await app.client
          .click('.add-button')
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside textarea[name=note]')
          .getText('.aside .actions')
      ).toBe('CancelSave')
    })

    it('highlights title field with error', async () => {
      expect(
        await app.client
          .click('.aside .actions .button')
          .isExisting('.field.error:nth-of-type(1)')
      ).toBe(true)
    })

    it('highlights note field with error', async () => {
      expect(
        await app.client
          .click('.aside .actions .button')
          .isExisting('.field.error:nth-of-type(2)')
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
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside textarea[name=note]')
          .getText('.aside .actions')
      ).toBe('CancelSave')
    })

    it('creates note entry', async () => {
      expect(
        await app.client
          .setValue('input[name=title]', 'Example')
          .setValue('textarea[name=note]', 'This is secure note')
          .click('.aside .actions .button')
          .getText('.body .list')
      ).toBe('Example')
    })

    it('shows details of created note', async () => {
      expect(await app.client.getText('.aside .entry-title h1')).toBe('Example')
    })
  })
})

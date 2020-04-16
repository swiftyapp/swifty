describe('Create credit card entry', () => {
  describe('user creates credit card entry', () => {
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

    it('switches to credit card scope', async () => {
      expect(
        await app.client
          .click('.switcher .tooltip-context:nth-child(3) .item')
          .getText('.body .list')
      ).toBe('No Items')
    })

    it('shows add credit card form', async () => {
      expect(
        await app.client
          .click('.add-button')
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside input[name=number]')
          .waitForExist('.aside input[name=year]')
          .waitForExist('.aside input[name=month]')
          .waitForExist('.aside input[name=cvc]')
          .waitForExist('.aside input[name=pin]')
          .waitForExist('.aside input[name=name]')
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

    it('highlights credit card number field with error', async () => {
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
          .waitForExist('.aside input[name=number]')
          .waitForExist('.aside input[name=year]')
          .waitForExist('.aside input[name=month]')
          .waitForExist('.aside input[name=cvc]')
          .waitForExist('.aside input[name=pin]')
          .waitForExist('.aside input[name=name]')
          .getText('.aside .actions')
      ).toBe('CancelSave')
    })

    it('creates credit card entry', async () => {
      expect(
        await app.client
          .setValue('input[name=title]', 'Visa Card')
          .setValue('input[name=number]', '4242424242424242')
          .setValue('input[name=year]', '2050')
          .setValue('input[name=month]', '06')
          .setValue('input[name=cvc]', '123')
          .setValue('input[name=pin]', '1234')
          .setValue('input[name=name]', 'Mister Miyagi')
          .click('.aside .actions .button')
          .getText('.body .list')
      ).toBe('Visa Card')
    })

    it('shows details of created credit card', async () => {
      expect(await app.client.getText('.aside .entry-title h1')).toBe(
        'Visa Card'
      )
    })

    it('shows card detail', async () => {
      expect(await app.client.getText('.aside .entry-details')).toBe(
        'Number\n4242 4242 4242 4242\nYear\n2050\nMonth\n06\nCVC\n123\nPin\n1234\nName\nMister Miyagi'
      )
    })
  })
})

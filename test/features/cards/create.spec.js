const { beforeHelper, afterHelper } = require('./../../helper')

describe('Create credit card entry', function() {
  this.timeout(10000)

  describe('user creates credit card entry', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows credentials view', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .getText('.body .list')
      ).to.eventually.equal('No Items')
    })

    it('switches to credit card scope', () => {
      return expect(
        app.client
          .click('.switcher .tooltip-context:nth-child(3) .item')
          .getText('.body .list')
      ).to.eventually.equal('No Items')
    })

    it('shows add credit card form', () => {
      return expect(
        app.client
          .click('.add-button')
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside input[name=number]')
          .waitForExist('.aside input[name=year]')
          .waitForExist('.aside input[name=month]')
          .waitForExist('.aside input[name=cvc]')
          .waitForExist('.aside input[name=pin]')
          .waitForExist('.aside input[name=name]')
          .getText('.aside .actions')
      ).to.eventually.equal('CancelSave')
    })

    it('highlights title field with error', () => {
      return expect(
        app.client
          .click('.aside .actions .button')
          .isExisting('.field.error:nth-of-type(1)')
      ).to.eventually.equal(true)
    })

    it('highlights credit card number field with error', () => {
      return expect(
        app.client
          .click('.aside .actions .button')
          .isExisting('.field.error:nth-of-type(2)')
      ).to.eventually.equal(true)
    })

    it('cancels entry creation', () => {
      return expect(
        app.client
          .setValue('input[name=title]', 'Example')
          .click('.aside .actions .cancel')
          .isExisting('.list .entry')
      ).to.eventually.equal(false)
    })

    it('hides creation form', () => {
      return expect(app.client.isExisting('.aside .empty')).to.eventually.equal(
        true
      )
    })

    it('opens creation form again', () => {
      return expect(
        app.client
          .click('.add-button')
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside input[name=number]')
          .waitForExist('.aside input[name=year]')
          .waitForExist('.aside input[name=month]')
          .waitForExist('.aside input[name=cvc]')
          .waitForExist('.aside input[name=pin]')
          .waitForExist('.aside input[name=name]')
          .getText('.aside .actions')
      ).to.eventually.equal('CancelSave')
    })

    it('creates credit card entry', () => {
      return expect(
        app.client
          .setValue('input[name=title]', 'Visa Card')
          .setValue('input[name=number]', '4242424242424242')
          .setValue('input[name=year]', '2050')
          .setValue('input[name=month]', '06')
          .setValue('input[name=cvc]', '123')
          .setValue('input[name=pin]', '1234')
          .setValue('input[name=name]', 'Mister Miyagi')
          .click('.aside .actions .button')
          .getText('.body .list')
      ).to.eventually.equal('Visa Card')
    })

    it('shows details of created credit card', () => {
      return expect(
        app.client.getText('.aside .entry-title h1')
      ).to.eventually.equal('Visa Card')
    })

    it('shows card detail', () => {
      return expect(
        app.client.getText('.aside .entry-details')
      ).to.eventually.equal(
        'Number\n4242 4242 4242 4242\nYear\n2050\nMonth\n06\nCVC\n123\nPin\n1234\nName\nMister Miyagi'
      )
    })
  })
})

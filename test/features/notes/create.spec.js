const { beforeHelper, afterHelper } = require('./../../helper')

describe('Create note entry', function() {
  this.timeout(10000)

  describe('user creates note entry', () => {
    before(() => beforeHelper({ storage: 'empty' }))

    after(() => afterHelper())

    it('shows credentials view', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys("\uE007")
          .waitForExist('.body .list')
          .getText('.body .list')
      ).to.eventually.equal('No Items')
    })

    it('switches to note scope', () => {
      return expect(
        app.client
          .click('.switcher .item:nth-child(2)')
          .getText('.body .list')
      ).to.eventually.equal('No Items')
    })
    
    it('shows add note form', () => {
      return expect(
        app.client
          .click('.add-button')
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside textarea[name=note]')
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
    
    it('highlights note field with error', () => {
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
      return expect(
        app.client.isExisting('.aside .empty')
      ).to.eventually.equal(true)
    })
    
    it('opens creation form again', () => {
      return expect(
        app.client
          .click('.add-button')
          .waitForExist('.aside input[name=title]')
          .waitForExist('.aside textarea[name=note]')
          .getText('.aside .actions')
      ).to.eventually.equal('CancelSave')
    })

    it('creates note entry', () => {
      return expect(
        app.client
          .setValue('input[name=title]', 'Example')
          .setValue('textarea[name=note]', 'This is secure note')
          .click('.aside .actions .button')
          .getText('.body .list')
      ).to.eventually.equal('Example')
    })
    
    it('shows details of created note', () => {
      return expect(
        app.client.getText('.aside .entry-title h1')
      ).to.eventually.equal('Example')
    })
  })
})

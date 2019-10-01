const { beforeHelper, afterHelper } = require('./../../helper')

describe('Passwords audit', function() {
  this.timeout(10000)

  describe('User opens vault settings', () => {
    before(() => beforeHelper({ storage: 'collection' }))

    after(() => afterHelper())

    it('shows vault settings', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .click('.audit-button')
          .getText('.aside .audit h3')
      ).to.eventually.equal('Password Audit')
    })

    it('contains weak passwords section', () => {
      return expect(
        app.client.getText('.audit-group.level-one .title')
      ).to.eventually.equal('Weak')
    })

    it('contains list of weak passwords', () => {
      return expect(
        app.client.getText('.audit-group.level-one')
      ).to.eventually.equal(
        'Weak\nInstagram\nanotheruser\nFacebook\nmyuser\nGoogle\nsomeuser'
      )
    })

    it('does not contain short passwords section', () => {
      return expect(
        app.client.isExisting('.audit-group.level-two')
      ).to.eventually.equal(false)
    })

    it('contains duplicate passwords section', () => {
      return expect(
        app.client.getText('.audit-group.level-three .title')
      ).to.eventually.equal('Duplicates')
    })

    it('contains list of duplicate passwords', () => {
      return expect(
        app.client.getText('.audit-group.level-three')
      ).to.eventually.equal(
        'Duplicates\nInstagram\nanotheruser\nFacebook\nmyuser\nGoogle\nsomeuser'
      )
    })

    it('does not contain short passwords section', () => {
      return expect(
        app.client.isExisting('.audit-group.level-four')
      ).to.eventually.equal(false)
    })
  })
})

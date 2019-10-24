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
        app.client.isExisting('.audit-group.level-two')
      ).to.eventually.equal(false)
    })

    it('displays passwords overal score', () => {
      return expect(app.client.getText('.aside .score')).to.eventually.equal(
        '0\nOveral Score'
      )
    })

    it('displays weak passwords count', () => {
      return expect(
        app.client.getText('.aside .stats li:nth-child(1)')
      ).to.eventually.equal('Weak\n3')
    })

    it('displays short passwords count', () => {
      return expect(
        app.client.getText('.aside .stats li:nth-child(2)')
      ).to.eventually.equal('Too Short\n0')
    })

    it('displays duplicate passwords count', () => {
      return expect(
        app.client.getText('.aside .stats li:nth-child(3)')
      ).to.eventually.equal('Duplicates\n3')
    })

    it('displays old passwords count', () => {
      return expect(
        app.client.getText('.aside .stats li:nth-child(4)')
      ).to.eventually.equal('More than 6 month old\n3')
    })
  })
})

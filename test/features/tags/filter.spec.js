const { beforeHelper, afterHelper } = require('./../../helper')

describe('Filter entries by tag', function() {
  this.timeout(10000)

  describe('user filters credentials', () => {
    before(() => beforeHelper({ storage: 'tagged' }))

    after(() => afterHelper())

    it('shows all credentials', () => {
      return expect(
        app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list .entry')
          .isExisting('.list .entry:nth-child(3)')
      ).to.eventually.equal(true)
    })

    it('displays tags dropdown', () => {
      return expect(
        app.client.click('.tag-icon').getText('.tag-filter .dropdown')
      ).to.eventually.equal('personal\nwork\ntest')
    })

    it('filters entries by tag', () => {
      return expect(
        app.client
          .click('.tag-filter .dropdown .dropdown-item:first-child')
          .isExisting('.list .entry:nth-child(2)')
      ).to.eventually.equal(false)
    })

    it('displays only matching entry', () => {
      return expect(app.client.getText('.list .entry')).to.eventually.equal(
        'Facebook\nmyuser'
      )
    })

    it('shows selected tag', () => {
      return expect(
        app.client.getText('.tag-filter .tag-selected')
      ).to.eventually.equal('personalx')
    })

    it('unfilters entries on clear tag', () => {
      return expect(
        app.client
          .click('.tag-selected .tag-clear')
          .isExisting('.list .entry:nth-child(3)')
      ).to.eventually.equal(true)
    })

    it('removes selected tag on clear', () => {
      return expect(
        app.client.isExisting('.tag-filter .tag-selected')
      ).to.eventually.equal(false)
    })

    it('filters entries by another tag', () => {
      return expect(
        app.client
          .click('.tag-icon')
          .click('.tag-filter .dropdown .dropdown-item:nth-child(2)')
          .isExisting('.list .entry:nth-child(2)')
      ).to.eventually.equal(true)
    })

    it('shows first matching entry', () => {
      return expect(
        app.client.getText('.list .entry:nth-child(1)')
      ).to.eventually.equal('Google\nsomeuser')
    })

    it('shows second matching entry', () => {
      return expect(
        app.client.getText('.list .entry:nth-child(2)')
      ).to.eventually.equal('Instagram\nanotheruser')
    })

    it('replaces currently selected tag', () => {
      return expect(
        app.client
          .click('.tag-icon')
          .click('.tag-filter .dropdown .dropdown-item:nth-child(3)')
          .getText('.tag-filter .tag-selected')
      ).to.eventually.equal('testx')
    })

    it('filters mathing entries', () => {
      return expect(
        app.client.getText('.list .entry:nth-child(1)')
      ).to.eventually.equal('Instagram\nanotheruser')
    })

    it('shows no other entries', () => {
      return expect(
        app.client.isExisting('.list .entry:nth-child(2)')
      ).to.eventually.equal(false)
    })
  })
})

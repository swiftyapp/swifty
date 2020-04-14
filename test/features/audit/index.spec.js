describe('Passwords audit', () => {
  describe('User opens vault settings', () => {
    beforeAll(async () => await before({ storage: 'collection' }))

    afterAll(async () => await after())

    it('shows vault settings', async () => {
      expect(
        await app.client
          .setValue('input[type=password]', 'password')
          .keys('\uE007')
          .waitForExist('.body .list')
          .click('.audit-button')
          .getText('.aside .audit h3')
      ).toBe('Password Audit')
    })

    it('contains weak passwords section', async () => {
      expect(await app.client.getText('.audit-group.level-one .title')).toBe(
        'Weak'
      )
    })

    it('contains list of weak passwords', async () => {
      expect(await app.client.getText('.audit-group.level-one')).toBe(
        'Weak\nFacebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
      )
    })

    it('contains duplicate passwords section', async () => {
      expect(await app.client.getText('.audit-group.level-three .title')).toBe(
        'Duplicates'
      )
    })

    it('contains list of duplicate passwords', async () => {
      expect(await app.client.getText('.audit-group.level-three')).toBe(
        'Duplicates\nFacebook\nmyuser\nGoogle\nsomeuser\nInstagram\nanotheruser'
      )
    })

    it('does not contain short passwords section', async () => {
      expect(await app.client.isExisting('.audit-group.level-two')).toBe(false)
    })

    it('displays passwords overal score', async () => {
      expect(await app.client.getText('.aside .score')).toBe('0\nOveral Score')
    })

    it('displays weak passwords count', async () => {
      expect(await app.client.getText('.aside .stats li:nth-child(1)')).toBe(
        'Weak\n3'
      )
    })

    it('displays short passwords count', async () => {
      expect(await app.client.getText('.aside .stats li:nth-child(2)')).toBe(
        'Too Short\n0'
      )
    })

    it('displays duplicate passwords count', async () => {
      expect(await app.client.getText('.aside .stats li:nth-child(3)')).toBe(
        'Duplicates\n3'
      )
    })

    it('displays old passwords count', async () => {
      expect(await app.client.getText('.aside .stats li:nth-child(4)')).toBe(
        'More than 6 month old\n3'
      )
    })
  })
})

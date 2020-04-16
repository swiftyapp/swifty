describe('Delete credentials entry', () => {
  describe('user deletes credentials entry', () => {
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

    it('deletes credentials entry', async () => {
      expect(
        await app.client
          .click('.entry-title .action:nth-of-type(2)')
          .getText('.body .list')
      ).toBe('No Items')
    })
  })
})

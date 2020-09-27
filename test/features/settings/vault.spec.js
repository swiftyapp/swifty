import { login } from 'helpers/login'
import { openSettingsSection } from 'helpers/settings'

describe('Vault settings', () => {
  describe('User opens vault settings', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows vault settings', async () => {
      await login(app)
      await openSettingsSection(app, 'vault')

      const header = await app.client.$('.body h1')
      expect(await header.getText()).toBe('Vault Settings')

      const button1 = await app.client.$('.section:nth-of-type(1) .button')
      const button2 = await app.client.$('.section:nth-of-type(2) .button')

      expect(await button1.getText()).toBe('Connect your Google Drive')
      expect(await button2.getText()).toBe('Save Vault File')
    })
  })
})

import { login } from 'helpers/login'
import { openSettingsSection } from 'helpers/settings'
import { setValue } from 'helpers/form'

describe('Password generation settings', () => {
  describe('User opens password settings', () => {
    beforeAll(async () => await before({ storage: 'empty' }))

    afterAll(async () => await after())

    it('shows password settings', async () => {
      await login(app)
      await openSettingsSection(app, 'generator')

      const header = await app.client.$('.body h1')
      expect(await header.getText()).toBe('Password Settings')

      const preview = await app.client.$(
        '.section:nth-of-type(1) .password-sample'
      )
      let previewValue = await preview.getText()
      expect(previewValue.length).toBe(12)

      await setValue(app, 'length', 28)

      previewValue = await preview.getText()
      expect(previewValue.length).toBe(28)

      await app.client.$('.section:nth-of-type(3) input[name=numbers]')
      await app.client.$('.section:nth-of-type(3) input[name=uppercase]')
      await app.client.$('.section:nth-of-type(3) input[name=symbols]')
    })
  })
})

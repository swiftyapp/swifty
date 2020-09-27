import { login } from 'helpers/login'
import { clickAddButton } from 'helpers/content'
import { setValue } from 'helpers/form'

describe('Create note entry', () => {
  beforeAll(async () => await before({ storage: 'empty' }))

  afterAll(async () => await after())

  it('shows credentials view', async () => {
    await login(app)

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe('No Items')

    const notesButton = await app.client.$(
      '.switcher .tooltip-context:nth-child(2)'
    )
    await notesButton.click()
    expect(await list.getText()).toBe('No Items')

    await clickAddButton(app)

    const actions = await app.client.$('.aside .actions')
    expect(await actions.getText()).toBe('CancelSave')

    const saveButton = await app.client.$('.aside .actions .button')
    await saveButton.click()

    await app.client.$('.field.error:nth-of-type(1)')
    await app.client.$('.field.error:nth-of-type(2)')

    await setValue(app, 'title', 'Example')

    const cancelButton = await app.client.$('.aside .actions .cancel')
    await cancelButton.click()

    expect(await list.getText()).toBe('No Items')

    const aside = await app.client.$('.aside')

    expect(await aside.getText()).toBe(
      'Swifty\nKeep your passwords safe and organized\nCreate First Entry\nor\nImport from Gdrive'
    )

    await clickAddButton(app)
    expect(await actions.getText()).toBe('CancelSave')

    await setValue(app, 'title', 'Example')
    await setValue(app, 'note', 'This is secure note')
    await saveButton.click()

    expect(await list.getText()).toBe('Example')

    const entryTitle = await app.client.$('.aside .entry-title')
    expect(await entryTitle.getText()).toBe('Example')
  })
})

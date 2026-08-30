const { login } = require('helpers/login')
const { clickSave, clickCancel, clickAdd, setValue } = require('helpers/form')

describe('Create credit card entry', () => {
  beforeEach(async () => await before({ storage: 'empty' }))

  afterEach(async () => await after())

  it('shows credentials view', async () => {
    await login(app)

    const list = await app.client.$('.body .list')
    expect(await list.getText()).toBe('No Items')

    const switcher = await app.client.$(
      '.switcher .tooltip-context:nth-child(3) .item'
    )
    await switcher.click()

    expect(await list.getText()).toBe('No Items')

    await clickAdd(app)

    const actions = await app.client.$('.aside .actions')
    expect(await actions.getText()).toBe('CancelSave')

    await clickSave(app)

    const error1 = await app.client.$('.field.error:nth-of-type(1)')
    expect(await error1.isExisting()).toBe(true)

    const error2 = await app.client.$('.field.error:nth-of-type(2)')
    expect(await error2.isExisting()).toBe(true)

    await setValue(app, 'title', 'Example')
    await clickCancel(app)

    expect(await list.getText()).toBe('No Items')

    const emptyAside = await app.client.$('.aside .empty')
    expect(await emptyAside.isExisting()).toBe(true)

    await clickAdd(app)

    await setValue(app, 'title', 'Visa Card')
    await setValue(app, 'number', '4242424242424242')
    await setValue(app, 'year', '2050')
    await setValue(app, 'month', '06')
    await setValue(app, 'cvc', '123')
    await setValue(app, 'pin', '1234')
    await setValue(app, 'name', 'Mister Miyagi')
    await clickSave(app)

    const detailsTitle = await app.client.$('.aside .entry-title h1')
    const details = await app.client.$('.aside .entry-details')
    expect(await detailsTitle.getText()).toBe('Visa Card')
    expect(await details.getText()).toBe(
      'Number\n4242 4242 4242 4242\nYear\n2050\nMonth\n06\nCVC\n123\nPin\n1234\nName\nMister Miyagi'
    )
  })
})

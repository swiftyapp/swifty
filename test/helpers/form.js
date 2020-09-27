export const clickSave = async app => {
  const button = await app.client.$('.aside .actions .button')
  await button.click()
}

export const clickCancel = async app => {
  const button = await app.client.$('.aside .actions .cancel')
  await button.click()
}

export const setValue = async (app, name, value) => {
  const input = await app.client.$(`input[name=${name}]`)
  await input.setValue(value)
}

export const clickAdd = async app => {
  const addButton = await app.client.$('.add-button')
  await addButton.click()
}

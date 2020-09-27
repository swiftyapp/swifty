export const clickAddButton = async app => {
  const button = await app.client.$('.add-button')
  await button.click()
}

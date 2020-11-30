export const onWindowMessage = function (_, data) {
  this.window[data.message]()
}

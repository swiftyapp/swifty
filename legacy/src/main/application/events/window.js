export const onWindowMessage = function (_, data) {
  this.window.window[data.message]()
}

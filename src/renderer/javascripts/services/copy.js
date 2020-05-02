const CLIPBOARD_TIMEOUT = 60000
const NOTIFICATION_TIMEOUT = 2000

export const copy = value => {
  const notification = document.getElementsByClassName('copied-notification')[0]
  window.copyToClipboard(value, CLIPBOARD_TIMEOUT)
  notification.classList.remove('hidden')
  setTimeout(() => {
    notification.classList.add('hidden')
  }, NOTIFICATION_TIMEOUT)
}

import { clipboard } from 'electron'

window.copyToClipboard = (value, timeout = false) => {
  clipboard.writeText(value)
  if (timeout) {
    setTimeout(() => {
      clipboard.clear()
    }, timeout)
  }
}

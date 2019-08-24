import { shell } from 'electron'
import './messages'
import './remote'
import './clipboard'
import './generator'

window.isSpectron = () => {
  return process.env.RUNNING_IN_SPECTRON
}

window.openLink = url => {
  shell.openExternal(url)
}

window.document.addEventListener('DOMContentLoaded', () => {})

import './messages'
import './remote'
import './clipboard'
import './generator'

window.isSpectron = () => {
  return process.env.RUNNING_IN_SPECTRON
}

window.document.addEventListener('DOMContentLoaded', () => {})

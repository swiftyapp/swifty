import { Application } from 'nucleon'
import Window from '../window'
import Manager from '../manager'
import { showSetup } from './setup'
import { showAuth } from './auth'

export default class Swifty extends Application {
  components() {
    return { Window }
  }

  windowOptions() {
    return {
      name: this.settings.name,
      width: this.settings.width,
      height: this .settings.height
    }
  }

  onReady() {
    this.manager = new Manager()
  }

  onWindowReady() {
    if (!this.manager.isTokenPresent()) {
      return showSetup(this.window, this.manager)
    }
    return showAuth(this.window, this.manager)
  }
}

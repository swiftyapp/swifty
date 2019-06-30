import { Application } from 'nucleon'
import Tray from './tray'
import Window from './window'

class Swifty extends Application {
  components() {
    return { Tray, Window }
  }
}

const app = new Swifty(SETTINGS)

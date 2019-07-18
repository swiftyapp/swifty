import path from 'path'
import { Window } from 'nucleon'

export default class MainWindow extends Window {
  sourceFile() {
    return path.resolve(__dirname, '..', 'renderer', 'index.html')
  }
}

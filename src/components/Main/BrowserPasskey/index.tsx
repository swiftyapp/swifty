import { useUi } from '@/store'
import PasskeyDialog from './PasskeyDialog'

/**
 * The gate for a passkey ceremony a page asked for through the browser
 * extension. A newer ask replaces the one on screen, and gets a dialog of its
 * own (keyed by the ask), so an account picked for the last one is not
 * carried over to it.
 */
export default function BrowserPasskey() {
  const ask = useUi(state => state.passkeyAsk)

  return ask ? <PasskeyDialog key={ask.id} ask={ask} /> : null
}

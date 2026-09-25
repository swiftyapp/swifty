import { useUi } from '@/store'
import PasskeyDialog from './PasskeyDialog'

/**
 * The gate for a passkey ceremony a page asked for through the browser
 * extension. A newer ask replaces the one on screen; the dialog keeps no
 * state of its own, so it simply redraws for it.
 */
export default function BrowserPasskey() {
  const ask = useUi(state => state.passkeyAsk)

  return ask ? <PasskeyDialog ask={ask} /> : null
}

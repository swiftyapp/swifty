import { useEffect } from 'react'
import { biometryType, isBiometricAvailable, isInitialized } from './lib/commands'
import { useStore, flowAuth, flowSetup } from './store'
import { subscribeToEvents } from './store/events'
import { useLayout } from './hooks/useLayout'
import Start from './components/Start'
import Auth from './components/Auth'
import LockScreen from './components/Auth/LockScreen'
import Main from './components/Main'
import UpdateToast from './components/elements/UpdateToast'

// The flow roots. Each one picks its own shell (rule 1: once per flow root,
// here and in `Main`) — the lock screen is not under `Main`, so this is where
// the phone's biometric-first layout is chosen over the desktop card.
function Shell() {
  const flow = useStore(state => state.flow)
  const compact = useLayout() === 'compact'
  switch (flow.name) {
    case 'setup':
      return <Start />
    case 'auth':
      return compact ? (
        <LockScreen touchID={flow.touchID} biometry={flow.biometry} />
      ) : (
        <Auth touchID={flow.touchID} biometry={flow.biometry} />
      )
    case 'main':
      return <Main />
  }
}

export default function App() {
  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    Promise.all([
      isInitialized(),
      isBiometricAvailable().catch(() => false),
      // Which biometry, not just whether: the same iOS build runs on Face ID
      // phones and Touch ID iPads.
      biometryType().catch(() => 'touch' as const)
    ])
      .then(([initialized, biometric, biometry]) =>
        initialized ? flowAuth(biometric, biometry) : flowSetup()
      )
      .catch(() => {})
    return unsubscribe
  }, [])

  return (
    <>
      <Shell />
      <UpdateToast />
    </>
  )
}

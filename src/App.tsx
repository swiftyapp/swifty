import { useEffect } from 'react'
import { isInitialized } from './lib/commands'
import { useApp, flowSetup, showLockScreen } from './store'
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
  const flow = useApp(state => state.flow)
  const touchID = useApp(state => state.touchID)
  const biometry = useApp(state => state.biometry)
  const compact = useLayout() === 'compact'
  switch (flow) {
    case 'setup':
      return <Start />
    case 'auth':
      return compact ? (
        <LockScreen touchID={touchID} biometry={biometry} />
      ) : (
        <Auth touchID={touchID} biometry={biometry} />
      )
    case 'main':
      return <Main />
  }
}

export default function App() {
  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    isInitialized()
      .then(initialized => (initialized ? showLockScreen() : flowSetup()))
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

import { useEffect } from 'react'
import { useApp, flowSetup } from './store'
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
  // Straight off the launch probe, so a lock that re-ran it redraws the button
  // rather than keeping a copy made at the last transition. Which biometry, not
  // just whether: the same iOS build runs on Face ID phones and Touch ID iPads.
  const gate = useApp(state => state.status?.biometric)
  const compact = useLayout() === 'compact'
  switch (flow) {
    case 'setup':
      return <Start />
    case 'auth': {
      const props = { biometric: !!gate?.available, biometry: gate?.type }
      return compact ? <LockScreen {...props} /> : <Auth {...props} />
    }
    case 'main':
      return <Main />
  }
}

export default function App() {
  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    // The boot probe already answered (main.tsx). Nothing on disk is the only
    // answer that sends us somewhere other than the lock screen — which is also
    // where a probe that failed leaves us, since `flow` starts there.
    if (useApp.getState().status?.initialized === false) flowSetup()
    return unsubscribe
  }, [])

  return (
    <>
      <Shell />
      <UpdateToast />
    </>
  )
}

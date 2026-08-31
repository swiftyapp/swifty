import { useEffect } from 'react'
import { isBiometricAvailable, isInitialized } from './lib/commands'
import { useStore, flowAuth, flowSetup } from './store'
import { subscribeToEvents } from './store/events'
import Start from './components/Start'
import Auth from './components/Auth'
import Main from './components/Main'
import UpdateToast from './components/elements/UpdateToast'

function Shell() {
  const flow = useStore(state => state.flow)
  switch (flow.name) {
    case 'setup':
      return <Start />
    case 'auth':
      return <Auth touchID={flow.touchID} />
    case 'main':
      return <Main />
  }
}

export default function App() {
  const locale = useStore(state => state.i18n.locale)

  useEffect(() => {
    const unsubscribe = subscribeToEvents()
    Promise.all([isInitialized(), isBiometricAvailable().catch(() => false)])
      .then(([initialized, biometric]) =>
        initialized ? flowAuth(biometric) : flowSetup()
      )
      .catch(() => {})
    return unsubscribe
  }, [])

  // `locale` as key remounts the tree on language change so `t()` re-runs.
  // The toast sits outside so a staged update stays visible across that remount.
  return (
    <>
      <Shell key={locale} />
      <UpdateToast />
    </>
  )
}

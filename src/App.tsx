import { useEffect } from 'react'
import { isBiometricAvailable } from './lib/commands'
import { useAppDispatch, useAppSelector } from './store'
import { flowAuth } from './store/flowSlice'
import { subscribeToEvents } from './store/events'
import Start from './components/Start'
import Auth from './components/Auth'
import Main from './components/Main'

function Shell() {
  const flow = useAppSelector(state => state.flow)
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
  const dispatch = useAppDispatch()
  const locale = useAppSelector(state => state.i18n.locale)

  useEffect(() => {
    const unsubscribe = subscribeToEvents(dispatch)
    isBiometricAvailable()
      .then(available => dispatch(flowAuth(available)))
      .catch(() => {})
    return unsubscribe
  }, [dispatch])

  // `locale` as key remounts the tree on language change so `t()` re-runs.
  return <Shell key={locale} />
}

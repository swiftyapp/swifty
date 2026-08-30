import { useEffect, useState } from 'react'
import { isBiometricAvailable, syncStatus } from './lib/commands'

// Placeholder shell. PR-5 replaces this with the real UI. It exists to prove
// the typed command wrappers round-trip to the Rust backend.
export default function App() {
  const [status, setStatus] = useState('connecting…')

  useEffect(() => {
    Promise.all([isBiometricAvailable(), syncStatus()])
      .then(([biometric, sync]) =>
        setStatus(
          `backend ok — biometric: ${biometric}, sync configured: ${sync.configured}`
        )
      )
      .catch(err => setStatus(`error: ${String(err)}`))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>Swifty</h1>
      <p>{status}</p>
    </main>
  )
}

import { useState } from 'react'
import Choice from './Choice'
import Setup from './Setup'
import Restore from './Restore'

type Flow = 'setup' | 'restore' | null

export function Start() {
  const [flow, setFlow] = useState<Flow>(null)

  if (!flow) return <Choice onSelect={setFlow} />
  if (flow === 'setup') return <Setup goBack={() => setFlow(null)} />
  return <Restore goBack={() => setFlow(null)} />
}

export default Start

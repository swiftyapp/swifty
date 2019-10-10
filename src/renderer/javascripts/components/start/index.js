import React, { useState } from 'react'
import Choice from './choice'
import Setup from './setup'
import Restore from './restore'

export default () => {
  const [flow, setFlow] = useState(null)

  if (!flow) return <Choice onSelect={setFlow} />
  if (flow === 'setup') {
    return <Setup goBack={() => setFlow(null)} />
  } else {
    return <Restore goBack={() => setFlow(null)} />
  }
}

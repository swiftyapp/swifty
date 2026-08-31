import { useState } from 'react'
import { unlock, unlockBiometric } from '@/lib/commands'
import { enterMain } from '@/store'
import { t } from '@/i18n'
import Masterpass from '@/components/elements/Masterpass'
import Controls from '@/components/elements/Controls'
import img from '@/assets/images/swifty.png'

interface Props {
  touchID: boolean
}

export function Auth({ touchID }: Props) {
  const [error, setError] = useState<string | null>(null)

  const handleEnter = (value: string) => {
    unlock(value)
      .then(result => enterMain(result))
      .catch(() => setError(t('Incorrect Master Password')))
  }

  const handleTouchId = () => {
    unlockBiometric()
      .then(result => enterMain(result))
      .catch(() => setError(t('Incorrect Master Password')))
  }

  return (
    <>
      <Controls />
      <div className="lock-screen">
        <div className="top-lock">
          <img src={img} alt="" width={72} />
        </div>
        <div className="bottom-lock">
          <Masterpass
            touchID={touchID}
            error={error}
            onChange={() => setError(null)}
            onEnter={handleEnter}
            onTouchID={handleTouchId}
          />
        </div>
      </div>
    </>
  )
}

export default Auth

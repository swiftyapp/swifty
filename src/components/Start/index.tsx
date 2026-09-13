import { useCallback, useState } from 'react'
import {
  biometryType,
  isBiometricAvailable,
  type BiometryType,
  type UnlockResult
} from '@/lib/commands'
import { enterMain, setupCreate } from '@/store'
import Welcome from './Welcome'
import Password from './Password'
import Sync from './Sync'
import Conflict from './Conflict'
import Drive from './Drive'
import File from './File'
import Biometric from './Biometric'
import { connectDrive, forgetDrive } from './shared/driveSession'

type Screen = 'welcome' | 'password' | 'sync' | 'conflict' | 'drive' | 'file' | 'biometric'

/**
 * The first run, end to end.
 *
 * Screens are a stack rather than a graph: every one of them is reached from
 * exactly one place, so "back" is "pop" and no screen has to know who sent it.
 * The two screens with nothing behind them — the welcome, and the biometric
 * question once the session is already open — are the two that draw no Go Back,
 * which falls out of the stack being one deep rather than being decided again
 * per screen.
 *
 * Nothing here enters the app until the very end: unlocking is not the last
 * step, enrolling a fingerprint is, and that can only be asked of an open
 * session.
 */
export function Start() {
  const [stack, setStack] = useState<Screen[]>(['welcome'])
  const screen = stack[stack.length - 1]

  const [password, setPassword] = useState('')
  // Consent already given, on the way through the restore screen: the create
  // flow adopts those tokens instead of asking for Drive a second time.
  const [driveLinked, setDriveLinked] = useState(false)
  const [result, setResult] = useState<UnlockResult | null>(null)
  const [biometry, setBiometry] = useState<BiometryType>('touch')

  const go = (next: Screen) => setStack(current => [...current, next])

  const back = () => {
    // Stepping out of the Drive screen towards the welcome gives the tokens
    // back: the user is no longer restoring from that account. Stepping back
    // into the conflict question keeps them — that screen is about the very
    // file this one was showing.
    if (screen === 'drive' && stack[stack.length - 2] === 'welcome') {
      forgetDrive()
      setDriveLinked(false)
    }
    // Backing out of the conflict question is refusing both of its answers, so
    // the account goes with it — the backup step would otherwise re-read the
    // probe still sitting in the store and bounce straight back here.
    if (screen === 'conflict') forgetDrive()
    setStack(current => (current.length > 1 ? current.slice(0, -1) : current))
  }

  /**
   * An open session, and one question left. Asking for biometrics costs two
   * probes, so it is only asked where it can be offered; everywhere else this
   * is simply the way in.
   */
  const finish = useCallback(async (unlocked: UnlockResult) => {
    const [available, type] = await Promise.all([
      isBiometricAvailable().catch(() => false),
      biometryType().catch(() => 'touch' as const)
    ])
    if (!available) return enterMain(unlocked)
    setResult(unlocked)
    setBiometry(type)
    // Replaces the stack: there is no going back from an unlocked session.
    setStack(['biometric'])
  }, [])

  const create = useCallback(
    (value: string, archiveRemote: boolean) =>
      setupCreate(value, archiveRemote).then(finish),
    [finish]
  )

  const createWithPassword = useCallback(
    () => create(password, false),
    [create, password]
  )

  const archiveAndCreate = useCallback(() => create(password, true), [create, password])

  const openDrive = () => {
    connectDrive()
    go('drive')
  }

  const continueFromPassword = (value: string) => {
    setPassword(value)
    // Coming back through the restore screen, Drive is already agreed: there is
    // no second step left to ask about.
    if (driveLinked) return create(value, false)
    go('sync')
    return Promise.resolve()
  }

  switch (screen) {
    case 'welcome':
      return (
        <Welcome
          onFresh={() => go('password')}
          onDrive={openDrive}
          onFile={() => go('file')}
        />
      )
    case 'password':
      return <Password onBack={back} onContinue={continueFromPassword} />
    case 'sync':
      return (
        <Sync
          onBack={back}
          onCreate={createWithPassword}
          onConflict={() => go('conflict')}
        />
      )
    case 'conflict':
      return (
        <Conflict
          onBack={back}
          onUnlockExisting={() => go('drive')}
          onArchive={archiveAndCreate}
        />
      )
    case 'drive':
      return (
        <Drive
          onBack={back}
          onStartFresh={() => {
            setDriveLinked(true)
            go('password')
          }}
          onUseFile={() => go('file')}
          onRestored={finish}
        />
      )
    case 'file':
      return <File onBack={back} onRestored={finish} />
    case 'biometric':
      return (
        <Biometric
          biometry={biometry}
          onDone={() => {
            if (result) void enterMain(result)
          }}
        />
      )
  }
}

export default Start

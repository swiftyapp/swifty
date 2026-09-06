import { useStore, closeGenerator } from '@/store'
import Dialog from './Dialog'

/**
 * The generator opened *from something* — a login's password row, the ssh
 * editor's Generate — which is an overlay over the screen that asked for it,
 * on any shell.
 *
 * The phone mounts this rather than `Generator` because the other kind of open
 * (standalone, nothing waiting for the value) is a tab root there, not a
 * dialog. Both read the same store; neither is told which shell it is in.
 */
export default function Attached() {
  const generator = useStore(state => state.generator)

  if (!generator.open || (!generator.apply && !generator.ssh)) return null
  return <Dialog apply={generator.apply} ssh={generator.ssh} onClose={closeGenerator} />
}

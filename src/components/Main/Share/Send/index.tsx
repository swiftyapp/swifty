import { useStore } from '@/store'
import SendDialog from './SendDialog'

/**
 * The gate, and nothing else: the dialog exists only while the store names an
 * entry to share. Rendering `null` around a mounted hook would keep a closed
 * dialog's link and errors alive, so unmounting is how they are dropped — and
 * the key makes "share a different entry" a different dialog for the same
 * reason.
 */
export default function Send() {
  const entryId = useStore(state => state.share.sendFor)

  return entryId ? <SendDialog key={entryId} entryId={entryId} /> : null
}

import { useStore } from '@/store'
import ReceiveDialog from './ReceiveDialog'

/**
 * The gate, and nothing else: the dialog exists only while it is open, so the
 * decrypted preview it was holding cannot outlive it. Reopening starts from an
 * empty field because there is nothing left to start from.
 */
export default function Receive() {
  const open = useStore(state => state.share.receiveOpen)

  return open ? <ReceiveDialog /> : null
}

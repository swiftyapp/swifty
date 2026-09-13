import Send from './Send'
import Receive from './Receive'

/**
 * Both halves of sharing, mounted once beside the kind picker: the
 * link being made and the link being opened. Each renders nothing until the
 * store says its dialog is up, and the two are never up together — one is a
 * thing you do to an entry you have, the other a way of getting one you do not.
 */
export default function Share() {
  return (
    <>
      <Send />
      <Receive />
    </>
  )
}

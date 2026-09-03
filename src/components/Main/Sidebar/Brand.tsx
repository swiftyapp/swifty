import Logo from '@/assets/images/logo.svg?react'
import { APP_NAME } from '@/lib/app'

// Single-vault app: the rail top is just a brand mark (no vault switcher).
//
// The mark is the lock-screen mascot with the face taken off: same hub, same
// flared spikes, same softened silhouette, same ink, so the sealed vault and
// the open one read as a single character. Its own twist is "Reveal": the
// lower-right spike is set free as a rounded head, the one secret taken out
// of the mask and into your hand. This renders the very file that ships as
// the logo elsewhere (baked from asteriskGeometry's MARK by `bun run logo`),
// with its fill retargeted to the themed brand ink.
export default function Brand() {
  return (
    <div
      className="grid h-9 w-9 flex-none place-items-center"
      title={APP_NAME}
    >
      <Logo width={24} height={24} className="fill-brand" />
    </div>
  )
}

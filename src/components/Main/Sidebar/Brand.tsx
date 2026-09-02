import AsteriskBody from '@/components/elements/Asterisk'

// Single-vault app: the rail top is just a brand mark (no vault switcher).
//
// The mark is the lock-screen mascot with the face taken off: same hub, same
// flared spikes, same softened silhouette, same ink, so the sealed vault and
// the open one read as a single character. Its own twist is "Reveal": the
// lower-right spike is set free as a dot, the one secret taken out of the mask
// and into your hand. With no face to carry, the hub is trimmed a step so the
// notches open and it still reads as an asterisk at rail size.
export default function Brand() {
  return (
    <div
      className="grid h-10 w-10 flex-none place-items-center text-brand"
      title="Swifty"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 64 64"
        fill="currentColor"
        aria-label="Swifty"
      >
        <AsteriskBody dot={120} hub={11} />
      </svg>
    </div>
  )
}

import { runUpdateCheck } from '@/store'
import { isMobile } from '@/lib/platform'
import VaultFooter from '@/components/elements/VaultFooter'

// The lock screen's footer, pinned under the nav. A phone updates through the
// App Store, so there the version is only a label.
export default function Footer() {
  return (
    // The inset lines the glyph up with the nav items' icons above it.
    <VaultFooter
      className="mt-4 ml-1"
      onCheckUpdates={isMobile ? undefined : () => runUpdateCheck()}
    />
  )
}

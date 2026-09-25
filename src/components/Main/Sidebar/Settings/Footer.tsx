import Logo from '@/assets/images/logo.svg?react'
import { runUpdateCheck } from '@/store'
import { isMobile } from '@/lib/platform'
import VaultFooter from '@/components/elements/VaultFooter'

// The lock screen's footer, pinned under the nav, signed with the brand mark.
// A phone updates through the App Store, so there the version is only a label.
export default function Footer() {
  return (
    // The inset lines the mark up with the nav items' icon tiles above it.
    <div className="mt-4 flex items-center gap-1.5 px-2">
      <Logo width={16} height={16} aria-hidden className="flex-none fill-brand" />
      <VaultFooter onCheckUpdates={isMobile ? undefined : () => runUpdateCheck()} />
    </div>
  )
}

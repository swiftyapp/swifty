import type { ReactNode } from 'react'

interface Props {
  icon: ReactNode
  // A node rather than SettingsRow's string: the backup row sets a chip in it.
  label: ReactNode
  description: string
}

// SettingsRow's tile, label and description, for the rows here that are laid
// out differently around them (a whole-row button, a label carrying a chip).
// Rendered into the caller's flex line, which also holds the trailing control.
export default function RowHead({ icon, label, description }: Props) {
  return (
    <>
      <div className="grid h-8 w-8 flex-none place-items-center rounded-sm bg-tile text-text2">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-base font-medium text-text">{label}</div>
        <div className="mt-0.5 text-base text-text2">{description}</div>
      </div>
    </>
  )
}

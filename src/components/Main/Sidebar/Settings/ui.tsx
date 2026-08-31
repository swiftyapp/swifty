import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

// Shared token-styled building blocks for the settings panels.

export const H1 = 'mb-5 text-xl font-semibold tracking-display text-text'
export const LABEL = 'block text-base font-medium text-text'
export const DESC = 'mt-1 text-base leading-relaxed text-text2'
export const MUTED = 'text-base leading-relaxed text-text3'
export const DANGER = 'text-base text-bad'
export const SUCCESS = 'text-base text-good'

export function Section({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cx('mb-7 flex flex-col gap-2.5', className)}>{children}</div>
}

// Button + inline status message (the legacy `.status-button` row).
export function StatusRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}

export function Checkbox({
  name,
  checked,
  onChange,
  children
}: {
  name: string
  checked: boolean
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  children: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-base text-text2">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 flex-none accent-accent"
      />
      {children}
    </label>
  )
}

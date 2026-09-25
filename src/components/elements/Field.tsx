import type { ReactNode } from 'react'

interface Props {
  /** The input the label names. Left out for a group that names itself
      (a radiogroup's aria-label), where a <label> would point at nothing. */
  id?: string
  label: string
  children: ReactNode
}

// One labelled field of a form: the label above, the input (and whatever hangs
// off it) below.
export default function Field({ id, label, children }: Props) {
  const Label = id ? 'label' : 'span'
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-base font-medium text-text2">
        {label}
      </Label>
      {children}
    </div>
  )
}

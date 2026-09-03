import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import SettingsRow from '@/components/elements/SettingsRow'

interface Props {
  label: string
  description?: string
  action: string
  testid?: string
  children: ReactNode
}

// A settings row whose control unfolds a short form beneath it, so the card
// stays a list of one-line rows until something is actually being changed.
export default function ExpandableRow({
  label,
  description,
  action,
  testid,
  children
}: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <SettingsRow
      label={label}
      description={description}
      testid={testid}
      control={
        <Button variant="pale" size="md" onClick={() => setOpen(!open)}>
          {open ? t('Cancel') : action}
        </Button>
      }
    >
      {open && children}
    </SettingsRow>
  )
}

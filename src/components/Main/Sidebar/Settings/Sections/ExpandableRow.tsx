import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/components/elements/Button'
import SettingsRow from '@/components/elements/SettingsRow'

interface Props {
  label: string
  description?: string
  // The row's 16px mark, drawn in SettingsRow's tile.
  icon?: ReactNode
  action: string
  testid?: string
  children: ReactNode
}

// A settings row whose control unfolds a short form beneath it, so the card
// stays a list of one-line rows until something is actually being changed.
export default function ExpandableRow({
  label,
  description,
  icon,
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
      icon={icon}
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

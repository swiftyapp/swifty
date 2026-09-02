import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsGroup from '@/components/elements/SettingsGroup'
import SettingsRow from '@/components/elements/SettingsRow'
import Toggle from '@/components/elements/Toggle'

describe('SettingsGroup / SettingsRow', () => {
  it('renders the group label above rows with label, description and control', () => {
    render(
      <SettingsGroup label="Security">
        <SettingsRow
          label="Biometric unlock"
          description="Use Touch ID instead of the passphrase"
          control={<Toggle checked onChange={vi.fn()} aria-label="Biometric unlock" />}
          testid="row-biometrics"
        />
      </SettingsGroup>
    )

    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByTestId('row-biometrics')).toBeInTheDocument()
    expect(screen.getByText('Use Touch ID instead of the passphrase')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Biometric unlock' })).toBeChecked()
  })

  it('renders expandable children beneath the row and keeps the control live', async () => {
    const onChange = vi.fn()
    render(
      <SettingsRow
        label="Master password"
        control={<Toggle checked={false} onChange={onChange} testid="row-toggle" />}
      >
        <input aria-label="New password" />
      </SettingsRow>
    )

    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    await userEvent.click(screen.getByTestId('row-toggle'))
    expect(onChange).toHaveBeenCalledWith(true)
  })
})

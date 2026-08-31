import type { ChangeEvent, KeyboardEvent } from 'react'
import { cx } from '@/utils/cx'
import { t } from '@/i18n'
import Error from './Error'
import Touchid from '@/assets/images/touchid.svg?react'

interface Props {
  error?: string | null
  touchID?: boolean
  disabled?: boolean
  placeholder?: string
  testid?: string
  onEnter?: (value: string) => void
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  onTouchID?: () => void
}

export default function Masterpass({
  error,
  touchID,
  disabled,
  placeholder,
  testid,
  onEnter,
  onChange,
  onTouchID
}: Props) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!disabled && event.key === 'Enter' && event.currentTarget.value !== '') {
      onEnter?.(event.currentTarget.value)
    }
  }

  return (
    <div className={cx('masterpass-input', { error: !!error })}>
      <Error error={error} />
      <input
        type="password"
        placeholder={placeholder || t('Master Password')}
        disabled={disabled}
        data-testid={testid}
        onChange={onChange}
        onKeyDown={handleKeyDown}
      />
      {touchID && (
        <Touchid
          width="32"
          height="32"
          className="touchid"
          onClick={onTouchID}
        />
      )}
    </div>
  )
}

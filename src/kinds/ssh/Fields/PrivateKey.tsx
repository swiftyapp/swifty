import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { openSshGenerator } from '@/store'
import CopyButton from '@/components/elements/CopyButton'
import IconButton from '@/components/elements/IconButton'
import { FieldRow, grow, useField, useFields } from '@/components/elements/fields'
import { requiredError } from '@/components/elements/fields/formats'
import { BLOCK_DOTS } from '@/components/elements/tokens'
import { EyeGlyph, EyeOffGlyph, RefreshGlyph } from '@/components/Main/icons'

// A textarea cannot fake dots, so the editor hides its own text; the read block
// gets the fixed block mask (BLOCK_DOTS) instead.
const MASK = { WebkitTextSecurity: 'disc' } as CSSProperties

// The OpenSSH private block: multiline, masked until asked for, and the one row
// the generator writes back through — a keypair is three draft keys, so the
// Generate button takes the field-set writer rather than this row's own setter.
export default function PrivateKey() {
  const { t } = useTranslation()
  const { set: write } = useFields()
  const { value, set, editing, attempted } = useField('privateKey')
  const [show, setShow] = useState(editing)

  if (!editing && value === '') return null

  const generate = () =>
    openSshGenerator(pair => {
      write?.('privateKey', pair.privateKey)
      write?.('publicKey', pair.publicKey)
      write?.('fingerprint', pair.fingerprint)
    })

  return (
    <FieldRow
      label="Private key"
      error={requiredError(value, true, attempted)}
      actions={
        <>
          {editing ? (
            <IconButton title={t('Generate')} testid="generate-ssh-key-link" onClick={generate}>
              <RefreshGlyph />
            </IconButton>
          ) : (
            <CopyButton value={value} title={t('Copy')} />
          )}
          <IconButton
            title={show ? t('Hide') : t('Reveal')}
            active={show}
            testid="reveal-privateKey"
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOffGlyph /> : <EyeGlyph />}
          </IconButton>
        </>
      }
    >
      {id =>
        editing ? (
          <textarea
            id={id}
            name="privateKey"
            value={value}
            rows={1}
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            spellCheck={false}
            ref={grow}
            style={show ? undefined : MASK}
            onChange={event => {
              grow(event.currentTarget)
              set(event.target.value)
            }}
            className="block min-h-6 w-full resize-none overflow-hidden border-b border-line2 bg-transparent font-mono text-base leading-relaxed text-text outline-none transition-colors placeholder:text-text3 focus:border-accent-line"
          />
        ) : (
          <div
            className={`break-all font-mono text-base leading-relaxed ${show ? 'whitespace-pre-wrap text-text' : 'text-text2'}`}
            data-testid="entry-value-privateKey"
          >
            {show ? value : BLOCK_DOTS}
          </div>
        )
      }
    </FieldRow>
  )
}

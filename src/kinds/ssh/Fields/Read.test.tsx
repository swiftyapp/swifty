import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldsProvider } from '@/components/elements/fields'
import type { EntryDraft } from '@/kinds/draft'
import Fields from '.'

const BODY = 'b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW'
const PRIVATE = `-----BEGIN OPENSSH PRIVATE KEY-----\n${BODY}\n-----END OPENSSH PRIVATE KEY-----\n`

const KEY: EntryDraft = {
  type: 'ssh',
  title: 'Deploy key',
  privateKey: PRIVATE,
  publicKey:
    'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDbXJwpmdubb27hkcjffuYYnPiq/v+pAExBAhyMvpB+w alice@laptop',
  fingerprint: 'SHA256:yq4WhqtjhSWoWZW2bkgxK9fflZopigYMOa/Xsyu5PxE',
  passphrase: '',
  note: ''
}

const read = (entry: EntryDraft = KEY) =>
  render(
    <FieldsProvider value={{ entry, set: null, attempted: false }}>
      <Fields />
    </FieldsProvider>
  )

describe('an SSH key, read', () => {
  it('sets the fingerprint on the plate with its randomart and the key chip', () => {
    read()
    const face = screen.getByTestId('ssh-face')
    expect(face).toHaveTextContent('+--[ED25519 256]--+')
    expect(face).toHaveTextContent('ED25519 · 256')
    expect(face).toHaveTextContent('SHA256')
    expect(screen.getByTestId('entry-value-fingerprint')).toHaveTextContent(
      'yq4WhqtjhSWoWZW2bkgxK9fflZopigYMOa/Xsyu5PxE'
    )
  })

  it('reads the comment off the public line as a row of its own', () => {
    read()
    expect(screen.getByTestId('entry-value-publicKey')).toHaveTextContent('ssh-ed25519')
    expect(screen.getByTestId('entry-value-comment')).toHaveTextContent('alice@laptop')
  })

  it('keeps the private key sealed until asked, armor showing', async () => {
    read()
    const block = screen.getByTestId('entry-value-privateKey')
    expect(block).toHaveTextContent('-----BEGIN OPENSSH PRIVATE KEY-----')
    expect(block).toHaveTextContent('-----END OPENSSH PRIVATE KEY-----')
    expect(block).not.toHaveTextContent(BODY)
    expect(screen.getByText(`OPENSSH · ${PRIVATE.length} bytes`)).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('unseal-privateKey'))
    expect(block).toHaveTextContent(BODY)
    expect(screen.queryByTestId('unseal-privateKey')).toBeNull()

    await userEvent.click(screen.getByTestId('reveal-privateKey'))
    expect(block).not.toHaveTextContent(BODY)
  })

  it('has no plate for a key pasted in without a fingerprint', () => {
    read({ ...KEY, fingerprint: '' })
    expect(screen.queryByTestId('ssh-face')).toBeNull()
    expect(screen.getByTestId('entry-value-publicKey')).toBeInTheDocument()
  })

  it('shows a fingerprint it cannot draw as text alone', () => {
    read({ ...KEY, fingerprint: 'MD5:16:27:ac:a5:76:28:2d:36' })
    const face = screen.getByTestId('ssh-face')
    expect(face).not.toHaveTextContent('+--')
    expect(face).toHaveTextContent('MD5')
    expect(screen.getByTestId('entry-value-fingerprint')).toHaveTextContent('16:27:ac:a5')
  })
})

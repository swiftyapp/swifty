interface Props {
  error?: string | null
}

export default function Error({ error }: Props) {
  if (!error) return null
  return (
    <div
      data-testid="form-error"
      className="mt-2.5 text-center font-mono text-xs tracking-label text-bad"
    >
      {error}
    </div>
  )
}

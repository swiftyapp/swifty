interface Props {
  error?: string | null
}

export default function Error({ error }: Props) {
  if (!error) return null
  return (
    <div className="mt-2.5 text-center font-mono text-[11px] tracking-[0.02em] text-bad">
      {error}
    </div>
  )
}

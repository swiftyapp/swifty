interface Props {
  count: number
  caret: boolean
}

// The masked passphrase: one dot per typed character, centered over the (text-
// transparent) input, with an optional blinking caret trailing them.
export default function Dots({ count, caret }: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="mx-[5px] h-2 w-2 rounded-full bg-text/75"
        />
      ))}
      {caret && (
        <span className="ml-1.5 h-6 w-px bg-accent animate-[caret_1.1s_steps(1,end)_infinite]" />
      )}
    </div>
  )
}

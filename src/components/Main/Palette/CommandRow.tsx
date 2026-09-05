import Row from './Row'
import type { Command } from './commands'
import { MONO_META } from '@/components/elements/tokens'

interface Props {
  id: string
  command: Command
  focused: boolean
  onRun: () => void
  onHover: () => void
}

export default function CommandRow({ id, command, focused, onRun, onHover }: Props) {
  const Glyph = command.glyph

  return (
    <Row
      id={id}
      focused={focused}
      onClick={onRun}
      onHover={onHover}
      className="rounded-sm px-2.5 py-[9px]"
    >
      <span className="grid w-5 flex-none place-items-center text-text3">
        <Glyph size={14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-base text-text2">{command.label}</span>
      {command.shortcut && (
        <span className={`flex-none ${MONO_META}`}>{command.shortcut}</span>
      )}
    </Row>
  )
}

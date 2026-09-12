import { describe, it, expect } from 'vitest'
import {
  appendVar,
  bandsOf,
  duplicateKeys,
  isValidKey,
  looksLikeEnv,
  parseEnv,
  removeLine,
  serializeEnv,
  setKey,
  setValue,
  varsOf,
  type EnvLine
} from './parse'

// Every awkward shape a real `.env` shows up with, in one file. Line numbers in
// the assertions below are logical indexes into `parseEnv(REALISTIC)`.
const REALISTIC = [
  '# Database',
  '# primary cluster',
  'DB_HOST=localhost',
  'export DB_PORT=5432 # default',
  "DB_PASS='p@ss word'",
  '',
  '# standalone note',
  '',
  'URL="https://${DB_HOST}:${DB_PORT}/x"',
  'CERT="-----BEGIN-----',
  'abc\\"def',
  '-----END-----"',
  'EMPTY=',
  'this line has no equals',
  'DB_HOST=override',
  '  INDENTED = spaced value  ',
  'ESC="a\\nb\\\\c"'
].join('\n')

const varAt = (lines: EnvLine[], i: number) => {
  const l = lines[i]
  if (l.kind !== 'var') throw new Error(`line ${i} is ${l.kind}`)
  return l
}

describe('parseEnv', () => {
  const lines = parseEnv(REALISTIC)

  it('reads each kind of line', () => {
    expect(lines.map((l) => l.kind)).toEqual([
      'comment',
      'comment',
      'var',
      'var',
      'var',
      'blank',
      'comment',
      'blank',
      'var',
      'var',
      'var',
      'other',
      'var',
      'var',
      'var'
    ])
  })

  it('reads keys, values, quotes, export and trailing comments', () => {
    expect(varAt(lines, 2)).toMatchObject({ key: 'DB_HOST', value: 'localhost', quote: '', exported: false })
    expect(varAt(lines, 3)).toMatchObject({
      key: 'DB_PORT',
      value: '5432',
      exported: true,
      comment: 'default',
      raw: 'export DB_PORT=5432 # default'
    })
    expect(varAt(lines, 4)).toMatchObject({ key: 'DB_PASS', value: 'p@ss word', quote: "'" })
    expect(varAt(lines, 2).comment).toBeUndefined()
  })

  it('keeps ${VAR} references literal', () => {
    expect(varAt(lines, 8).value).toBe('https://${DB_HOST}:${DB_PORT}/x')
  })

  it('folds a multi-line double-quoted value into one logical line', () => {
    const cert = varAt(lines, 9)
    expect(cert.raw).toBe('CERT="-----BEGIN-----\nabc\\"def\n-----END-----"')
    expect(cert.value).toBe('-----BEGIN-----\nabc"def\n-----END-----')
    expect(cert.quote).toBe('"')
  })

  it('decodes \\n, \\" and \\\\ in double quotes and nothing in single quotes', () => {
    expect(varAt(lines, 14).value).toBe('a\nb\\c')
    expect(parseEnv("A='x\\ny'")[0]).toMatchObject({ value: 'x\\ny' })
  })

  it('reads an empty value, whitespace around =, and comment text', () => {
    expect(varAt(lines, 10)).toMatchObject({ key: 'EMPTY', value: '', quote: '' })
    expect(varAt(lines, 13)).toMatchObject({ key: 'INDENTED', value: 'spaced value' })
    expect(lines[0]).toMatchObject({ kind: 'comment', text: 'Database' })
    expect(parseEnv('#no space')[0]).toMatchObject({ text: 'no space' })
  })

  it('keeps an unterminated quote or a line without = as other', () => {
    expect(parseEnv('A="open').map((l) => l.kind)).toEqual(['other'])
    expect(parseEnv("A='open\nB=1").map((l) => l.kind)).toEqual(['other', 'var'])
    expect(lines[11]).toEqual({ kind: 'other', raw: 'this line has no equals' })
  })

  it('treats a # inside a bare value as part of it', () => {
    expect(parseEnv('A=a#b')[0]).toMatchObject({ value: 'a#b' })
    expect(varAt(parseEnv('A=a#b'), 0).comment).toBeUndefined()
    expect(parseEnv('A= #c')[0]).toMatchObject({ value: '', comment: 'c' })
  })

  it('keeps the BOM and \\r in raw but out of the key and value', () => {
    const l = parseEnv('\uFEFFA=1\r\nB=2\r\n')
    expect(l[0]).toMatchObject({ kind: 'var', key: 'A', value: '1', raw: '\uFEFFA=1\r' })
    expect(l[1]).toMatchObject({ kind: 'var', key: 'B', value: '2', raw: 'B=2\r' })
    expect(l[2]).toEqual({ kind: 'blank', raw: '' })
    expect(parseEnv('\uFEFF# c\r')[0]).toMatchObject({ kind: 'comment', text: 'c' })
  })

  it('reads a multi-line value in a CRLF file with \\n in the value', () => {
    const l = parseEnv('A="x\r\ny"\r\nB=1\r\n')
    expect(varAt(l, 0).value).toBe('x\ny')
    expect(varAt(l, 1).key).toBe('B')
  })
})

describe('serializeEnv', () => {
  const bodies = [
    '',
    '\n',
    '\n\n\n',
    'A=1',
    'A=1\n',
    'A=1\n\n\n',
    'A=1\r\nB=2\r\n',
    '\uFEFFA=1\n',
    'A="x\ny"',
    'A="x\ny"\n',
    'A="open\nB=1\n',
    '   \n\t\nA = 1 \n',
    REALISTIC,
    REALISTIC + '\n'
  ]

  it.each(bodies)('round-trips %j byte for byte', (body) => {
    expect(serializeEnv(parseEnv(body))).toBe(body)
  })
})

describe('varsOf and duplicateKeys', () => {
  it('lists vars with their logical index', () => {
    const vars = varsOf(parseEnv(REALISTIC))
    expect(vars.map((v) => [v.index, v.key])).toEqual([
      [2, 'DB_HOST'],
      [3, 'DB_PORT'],
      [4, 'DB_PASS'],
      [8, 'URL'],
      [9, 'CERT'],
      [10, 'EMPTY'],
      [12, 'DB_HOST'],
      [13, 'INDENTED'],
      [14, 'ESC']
    ])
    expect(vars[1].comment).toBe('default')
    expect(duplicateKeys(vars)).toEqual(new Set(['DB_HOST']))
  })
})

describe('bandsOf', () => {
  it('captions a band with the comment block directly above its first var', () => {
    const bands = bandsOf(parseEnv(REALISTIC))
    expect(bands.map((b) => [b.caption, b.vars.map((v) => v.key)])).toEqual([
      ['Database primary cluster', ['DB_HOST', 'DB_PORT', 'DB_PASS']],
      [null, ['URL', 'CERT', 'EMPTY', 'DB_HOST', 'INDENTED', 'ESC']]
    ])
  })

  it('does not caption vars separated from a comment by a blank', () => {
    const bands = bandsOf(parseEnv('# alone\n\nA=1\n# inside\nB=2\n\n# top\nC=3'))
    expect(bands).toEqual([
      { caption: null, vars: [{ index: 2, key: 'A', value: '1' }, { index: 4, key: 'B', value: '2' }] },
      { caption: 'top', vars: [{ index: 7, key: 'C', value: '3' }] }
    ])
  })

  it('returns nothing for a file with no vars', () => {
    expect(bandsOf(parseEnv('# only\n\nnot a var\n'))).toEqual([])
  })
})

describe('setValue', () => {
  it('keeps a bare value bare and preserves export, spacing and the comment', () => {
    expect(setValue('export A = 1 # c\nB=2', 0, 'two')).toBe('export A = two # c\nB=2')
  })

  it('keeps the existing quote style when the value fits', () => {
    expect(setValue("A='x'", 0, 'y z')).toBe("A='y z'")
    expect(setValue('A="x"', 0, 'y')).toBe('A="y"')
    expect(setValue('A=x', 0, 'a b')).toBe('A=a b')
  })

  it('switches to double quotes when the value does not fit', () => {
    expect(setValue('A=x', 0, 'has # hash')).toBe('A="has # hash"')
    expect(setValue('A=x', 0, ' padded')).toBe('A=" padded"')
    expect(setValue('A=x', 0, 'multi\nline')).toBe('A="multi\\nline"')
    expect(setValue('A=x', 0, '"edge"')).toBe('A="\\"edge\\""')
    expect(setValue("A='x'", 0, "it's")).toBe(`A="it's"`)
    expect(setValue('A="x"', 0, 'q"b\\s')).toBe('A="q\\"b\\\\s"')
  })

  it('writes an empty value bare unless the line was quoted', () => {
    expect(setValue('A=x', 0, '')).toBe('A=')
    expect(setValue("A='x'", 0, '')).toBe("A=''")
    expect(setValue('A="x"', 0, '')).toBe('A=""')
  })

  it('collapses a multi-line value to one physical line with escapes', () => {
    expect(setValue('A="x\ny"\nB=1', 0, 'p\nq')).toBe('A="p\\nq"\nB=1')
  })

  it('keeps \\r and the comment after an empty value readable', () => {
    expect(setValue('A=1\r\nB=2\r\n', 1, 'z')).toBe('A=1\r\nB=z\r\n')
    expect(setValue('A= #c', 0, 'v')).toBe('A= v #c')
  })

  it('returns the body unchanged for a non-var or missing index', () => {
    const body = '# c\nA=1\n'
    expect(setValue(body, 0, 'x')).toBe(body)
    expect(setValue(body, 2, 'x')).toBe(body)
    expect(setValue(body, 9, 'x')).toBe(body)
  })
})

describe('setKey', () => {
  it('replaces only the key span', () => {
    expect(setKey('export A = "1" # c\r\nB=2', 0, 'RENAMED')).toBe('export RENAMED = "1" # c\r\nB=2')
  })

  it('refuses an invalid key or a non-var index', () => {
    expect(setKey('A=1\n# c', 0, '1BAD')).toBe('A=1\n# c')
    expect(setKey('A=1\n# c', 1, 'B')).toBe('A=1\n# c')
  })
})

describe('removeLine', () => {
  it('drops the line and its newline', () => {
    expect(removeLine('A=1\nB=2\nC=3\n', 1)).toBe('A=1\nC=3\n')
    expect(removeLine('A=1\nB=2\nC=3\n', 0)).toBe('B=2\nC=3\n')
    expect(removeLine('A=1\r\nB=2\r\n', 1)).toBe('A=1\r\n')
  })

  it('takes the preceding newline when removing the last line of an unterminated file', () => {
    expect(removeLine('A=1\nB=2', 1)).toBe('A=1')
    expect(removeLine('A=1', 0)).toBe('')
  })

  it('removes a whole multi-line value and ignores a bad index', () => {
    expect(removeLine('A="x\ny"\nB=1\n', 0)).toBe('B=1\n')
    expect(removeLine('A=1\n', 5)).toBe('A=1\n')
  })
})

describe('appendVar', () => {
  it('appends at the end, adding a newline first when the file lacks one', () => {
    expect(appendVar('', 'A', '1')).toBe('A=1\n')
    expect(appendVar('A=1\n', 'B', '2')).toBe('A=1\nB=2\n')
    expect(appendVar('A=1', 'B', '2')).toBe('A=1\nB=2\n')
    expect(appendVar('A=1\r\n', 'B', '2')).toBe('A=1\r\nB=2\r\n')
  })

  it('inserts after a logical line', () => {
    expect(appendVar('A=1\n\nB=2\n', 'X', 'y', 0)).toBe('A=1\nX=y\n\nB=2\n')
    expect(appendVar('A="x\ny"\nB=2\n', 'X', 'y', 0)).toBe('A="x\ny"\nX=y\nB=2\n')
    expect(appendVar('A=1\r\nB=2\r\n', 'X', 'y', 1)).toBe('A=1\r\nB=2\r\nX=y\r\n')
    expect(appendVar('A=1\nB=2', 'X', 'y', 1)).toBe('A=1\nB=2\nX=y')
  })

  it('quotes only when the value needs it', () => {
    expect(appendVar('', 'A', 'plain value')).toBe('A=plain value\n')
    expect(appendVar('', 'A', 'a # b')).toBe('A="a # b"\n')
    expect(appendVar('', 'A', 'l1\nl2')).toBe('A="l1\\nl2"\n')
    expect(appendVar('', 'A', '')).toBe('A=\n')
  })
})

describe('isValidKey', () => {
  it('accepts identifiers and rejects the rest', () => {
    expect(isValidKey('A_1')).toBe(true)
    expect(isValidKey('_a')).toBe(true)
    expect(isValidKey('1A')).toBe(false)
    expect(isValidKey('A-B')).toBe(false)
    expect(isValidKey('')).toBe(false)
    expect(isValidKey('A B')).toBe(false)
  })
})

describe('looksLikeEnv', () => {
  it('needs more than one line and at least one var', () => {
    expect(looksLikeEnv('A=1\nB=2')).toBe(true)
    expect(looksLikeEnv('# c\nA=1\n')).toBe(true)
    expect(looksLikeEnv('A=1')).toBe(false)
    expect(looksLikeEnv('A=1\n')).toBe(false)
    expect(looksLikeEnv('just\nsome text')).toBe(false)
    expect(looksLikeEnv('')).toBe(false)
  })
})

describe('edits leave every other line untouched', () => {
  const bodies = [
    REALISTIC,
    REALISTIC + '\n',
    'A=1\r\nexport B="two"\r\n\r\n# c\r\nC=\'3\' # t\r\n',
    '\uFEFFA=1\nB="x\ny"\nC=z',
    'A= #c\nB=1'
  ]
  const values = ['', 'plain', ' lead', 'trail ', 'a # b', 'two\nlines', `it's "q" \\ back`, '${REF}']

  it.each(bodies)('for %j', (body) => {
    expect(serializeEnv(parseEnv(body))).toBe(body)
    const before = parseEnv(body)
    before.forEach((line, i) => {
      if (line.kind !== 'var') return
      for (const v of values) {
        const after = parseEnv(setValue(body, i, v))
        expect(after).toHaveLength(before.length)
        expect(varAt(after, i)).toMatchObject({ key: line.key, value: v, exported: line.exported })
        expect(varAt(after, i).comment).toBe(line.comment)
        after.forEach((l, j) => {
          if (j !== i) expect(l.raw).toBe(before[j].raw)
        })
      }
    })
  })
})

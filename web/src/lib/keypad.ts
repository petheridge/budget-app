// What each key on the app's amount keypad does to the text being typed.

export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '+' | '−' | '×' | '÷' | 'back'

export interface PadState {
  text: string
  /**
   * True while the text is a value that was already there (a saved amount, or the
   * result of the last sum). Then a digit starts a new amount, while an operator
   * carries on from it, so "+ 250" adds to the current value.
   */
  fresh: boolean
}

const OPERATORS = ['+', '−', '×', '÷']
const isOperator = (char: string | undefined) => !!char && OPERATORS.includes(char)

export function pressKey({ text, fresh }: PadState, key: PadKey): PadState {
  if (key === 'back') return { text: text.slice(0, -1), fresh: false }

  if (isOperator(key)) {
    if (text === '') return { text, fresh }
    // A second operator replaces the first.
    if (isOperator(text.at(-1))) return { text: text.slice(0, -1) + key, fresh: false }
    return { text: text + key, fresh: false }
  }

  if (fresh) text = ''
  // The number being typed: everything after the last operator.
  const current = text.split(/[+−×÷]/).at(-1) ?? ''
  if (key === '.') {
    if (current.includes('.')) return { text, fresh: false }
    return { text: text + (current === '' ? '0.' : '.'), fresh: false }
  }
  // No leading zeros: "0" then "5" is "5".
  if (current === '0') return { text: text.slice(0, -1) + key, fresh: false }
  return { text: text + key, fresh: false }
}

/** A computer keyboard key as a keypad key, for typing amounts on a desktop. */
export function keyFromKeyboard(key: string): PadKey | null {
  if (/^[0-9]$/.test(key) || key === '.' || key === '+') return key as PadKey
  if (key === ',') return '.'
  if (key === '-') return '−'
  if (key === '*' || key === 'x') return '×'
  if (key === '/') return '÷'
  if (key === 'Backspace') return 'back'
  return null
}

/** "12400+250" as "12400 + 250", for showing a sum. */
export function spaceOperators(text: string): string {
  return text.replace(/([+−×÷])/g, ' $1 ')
}

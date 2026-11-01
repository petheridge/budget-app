// All money is integer pence. Nothing here goes through a float.

/** income/expense belong to budgets; saving/debt to savings & debts budgets. */
export type EntryType = 'income' | 'expense' | 'saving' | 'debt'

/** Income and savings add to a total; expenses and debts take from it. */
export function isPositive(type: EntryType): boolean {
  return type === 'income' || type === 'saving'
}

export interface Amount {
  amount_pence: number
  type: EntryType
}

export function signedValue({ amount_pence, type }: Amount): number {
  return isPositive(type) ? amount_pence : -amount_pence
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function incomeTotal(entries: Amount[]): number {
  return typeTotal(entries, 'income')
}

export function expenseTotal(entries: Amount[]): number {
  return typeTotal(entries, 'expense')
}

export function typeTotal(entries: Amount[], type: EntryType): number {
  return sum(entries.filter((e) => e.type === type).map((e) => e.amount_pence))
}

/** Budget balance, or net worth for a savings & debts budget. */
export function balance(entries: Amount[]): number {
  return sum(entries.map(signedValue))
}

const thousands = new Intl.NumberFormat('en-GB')

/** Unsigned, e.g. 928930 -> "£ 9,289.30". */
export function formatUnsigned(pence: number): string {
  const abs = Math.abs(pence)
  const pounds = Math.floor(abs / 100)
  const remainder = String(abs % 100).padStart(2, '0')
  return `£ ${thousands.format(pounds)}.${remainder}`
}

/** Signed, e.g. "+ £ 9,289.30", "- £ 5,430.59", "£ 0.00". */
export function formatSigned(pence: number): string {
  if (pence === 0) return formatUnsigned(0)
  return `${pence > 0 ? '+' : '-'} ${formatUnsigned(pence)}`
}

/** Tailwind text colour for an entry's type: green for income and savings, red-orange otherwise. */
export function typeColour(type: EntryType): string {
  return isPositive(type) ? 'text-income' : 'text-expense'
}

/** A saving going up, or a debt going down. */
export function isGoodChange(type: EntryType, change: number): boolean {
  return isPositive(type) ? change > 0 : change < 0
}

/** Tailwind text colour for a balance. Entry amounts use their type colour instead. */
export function balanceColour(pence: number): string {
  if (pence > 0) return 'text-income'
  if (pence < 0) return 'text-expense'
  return 'text-muted'
}

/**
 * Parses what someone typed into the amount field. Accepts "12", "12.5", "12.50", ".5",
 * "1,234.56" and a leading "£". Returns null if it isn't a valid non-negative amount.
 */
export function parsePence(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, '')
  const match = /^(\d*)(?:\.(\d{0,2}))?$/.exec(cleaned)
  if (!match || (match[1] === '' && !match[2])) return null
  const pence = Number(match[1] || '0') * 100 + Number((match[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(pence) ? pence : null
}

/** For pre-filling the edit sheet, e.g. 123456 -> "1234.56". */
export function penceToInput(pence: number): string {
  return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`
}

export type AmountResult = { ok: true; pence: number } | { ok: false; error: string }

/** The keypad's operator symbols, plus the keyboard's for typing on a computer. */
const OPERATORS: Record<string, '+' | '-' | '*' | '/'> = {
  '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', x: '*', '/': '/', '÷': '/',
}

/** "12.5" -> 125 / 10, exactly: no floats. */
function parseFraction(text: string): { n: number; d: number } | null {
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return null
  const [whole, decimals = ''] = text.split('.')
  const d = 10 ** decimals.length
  const n = Number(whole || '0') * d + Number(decimals || '0')
  return Number.isSafeInteger(n) && Number.isSafeInteger(d) ? { n, d } : null
}

/** Rounds n / d (both non-negative) to the nearest whole number, halves up. */
function roundDiv(n: number, d: number): number {
  const q = Math.floor(n / d)
  return 2 * (n - q * d) >= d ? q + 1 : q
}

/**
 * Works out a typed amount or sum, in whole pence. Accepts plain amounts ("12.50",
 * "£1,234.56") and sums like "12400+250", "1200÷12" or "48×12".
 *
 * In each part of a sum, the first number is money (up to 2 decimal places) and
 * any number it's multiplied or divided by is a plain number, so "1200÷12" is
 * £100.00. × and ÷ come before + and −. Each part is rounded to the penny.
 * A trailing operator is ignored. Returns null for an empty input.
 */
export function evaluateAmount(input: string): AmountResult | null {
  const text = input.replace(/[£,\s]/g, '')
  if (text === '') return null
  const tokens = text.match(/\d+\.\d*|\.\d+|\d+|[+\-−*×x/÷]/g)
  if (!tokens || tokens.join('') !== text) return { ok: false, error: 'Check the amount, like 12.50' }
  while (tokens.length && OPERATORS[tokens[tokens.length - 1]]) tokens.pop()
  if (!tokens.length) return null

  let total = 0
  let sign = 1
  let i = 0
  if (OPERATORS[tokens[0]] === '-' || OPERATORS[tokens[0]] === '+') {
    sign = OPERATORS[tokens[0]] === '-' ? -1 : 1
    i = 1
  }
  while (i < tokens.length) {
    // One part: money, then any × or ÷ by plain numbers.
    const money = parseFraction(tokens[i] ?? '')
    if (!money) return { ok: false, error: 'Check the sum' }
    if (money.d > 100) return { ok: false, error: 'Use up to 2 decimal places for amounts' }
    let n = money.n * (100 / money.d)
    let d = 1
    i++
    while (i < tokens.length && (OPERATORS[tokens[i]] === '*' || OPERATORS[tokens[i]] === '/')) {
      const op = OPERATORS[tokens[i]]
      const factor = parseFraction(tokens[i + 1] ?? '')
      if (!factor) return { ok: false, error: 'Check the sum' }
      if (op === '/' && factor.n === 0) return { ok: false, error: "Can't divide by zero" }
      n *= op === '*' ? factor.n : factor.d
      d *= op === '*' ? factor.d : factor.n
      if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) return { ok: false, error: "That's too large" }
      i += 2
    }
    total += sign * roundDiv(n, d)
    if (i >= tokens.length) break
    const op = OPERATORS[tokens[i]]
    if (op !== '+' && op !== '-') return { ok: false, error: 'Check the sum' }
    sign = op === '-' ? -1 : 1
    i++
  }
  if (!Number.isSafeInteger(total)) return { ok: false, error: "That's too large" }
  if (total < 0) return { ok: false, error: "Can't be less than £ 0.00" }
  return { ok: true, pence: total }
}

/** True when the text is a sum rather than a single amount. */
export function isSum(input: string): boolean {
  return /\d\s*[+\-−*×x/÷]\s*[\d.]/.test(input.replace(/[£,]/g, ''))
}

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

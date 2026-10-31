import { describe, expect, it } from 'vitest'
import {
  type Amount,
  balance,
  balanceColour,
  expenseTotal,
  formatSigned,
  formatUnsigned,
  incomeTotal,
  parsePence,
  penceToInput,
  signedValue,
  sum,
} from './money'

const income = (amount_pence: number): Amount => ({ amount_pence, type: 'income' })
const expense = (amount_pence: number): Amount => ({ amount_pence, type: 'expense' })

describe('formatSigned', () => {
  it('formats positive, negative and zero to the brief', () => {
    expect(formatSigned(928930)).toBe('+ £ 9,289.30')
    expect(formatSigned(-543059)).toBe('- £ 5,430.59')
    expect(formatSigned(0)).toBe('£ 0.00')
  })

  it('pads pence and handles sub-pound values', () => {
    expect(formatSigned(5)).toBe('+ £ 0.05')
    expect(formatSigned(-50)).toBe('- £ 0.50')
    expect(formatSigned(100)).toBe('+ £ 1.00')
  })

  it('adds thousands separators to large values', () => {
    expect(formatSigned(123456789)).toBe('+ £ 1,234,567.89')
  })
})

describe('formatUnsigned', () => {
  it('drops the sign', () => {
    expect(formatUnsigned(-543059)).toBe('£ 5,430.59')
    expect(formatUnsigned(0)).toBe('£ 0.00')
  })
})

describe('totals', () => {
  const entries = [income(10000), expense(2550), income(1), expense(0)]

  it('signs values by type', () => {
    expect(signedValue(income(5))).toBe(5)
    expect(signedValue(expense(5))).toBe(-5)
  })

  it('totals income, expenses and balance', () => {
    expect(incomeTotal(entries)).toBe(10001)
    expect(expenseTotal(entries)).toBe(2550)
    expect(balance(entries)).toBe(7451)
  })

  it('gives zero for nothing', () => {
    expect(balance([])).toBe(0)
    expect(sum([])).toBe(0)
  })

  it('does not accumulate float error', () => {
    expect(balance([income(10), income(20)])).toBe(30) // 0.1 + 0.2 in pounds
  })
})

describe('balanceColour', () => {
  it('maps sign to colour', () => {
    expect(balanceColour(1)).toBe('text-income')
    expect(balanceColour(-1)).toBe('text-expense')
    expect(balanceColour(0)).toBe('text-muted')
  })
})

describe('parsePence', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['12.', 1200],
    ['.5', 50],
    ['0', 0],
    ['1,234.56', 123456],
    ['£ 19.99', 1999],
    ['4.35', 435], // 4.35 * 100 is 434.99… as a float
    ['1.10', 110],
  ])('parses %s', (input, expected) => {
    expect(parsePence(input)).toBe(expected)
  })

  it.each(['', '.', 'abc', '1.234', '-5', '1.2.3', '99999999999999999999'])('rejects %j', (input) => {
    expect(parsePence(input)).toBeNull()
  })
})

describe('penceToInput', () => {
  it('round-trips through parsePence', () => {
    for (const pence of [0, 5, 50, 435, 123456]) {
      expect(parsePence(penceToInput(pence))).toBe(pence)
    }
  })
})

import { describe, expect, it } from 'vitest'
import {
  type Amount,
  balance,
  balanceColour,
  expenseTotal,
  formatSigned,
  formatUnsigned,
  incomeTotal,
  unpaidTotal,
  evaluateAmount,
  penceToInput,
  isGoodChange,
  signedValue,
  sum,
  typeColour,
  typeTotal,
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

describe('unpaidTotal', () => {
  it('adds up the expenses not ticked off as paid, and nothing else', () => {
    expect(
      unpaidTotal([
        { amount_pence: 320000, type: 'income' },
        { amount_pence: 90000, type: 'expense', paid: true },
        { amount_pence: 4800, type: 'expense' },
        { amount_pence: 1250, type: 'expense', paid: false },
      ]),
    ).toBe(6050)
    expect(unpaidTotal([])).toBe(0)
  })
})

describe('penceToInput', () => {
  it('round-trips through evaluateAmount', () => {
    for (const pence of [0, 5, 50, 435, 123456]) {
      expect(evaluateAmount(penceToInput(pence))).toEqual({ ok: true, pence })
    }
  })
})

describe('savings and debts', () => {
  const saving = (amount_pence: number): Amount => ({ amount_pence, type: 'saving' })
  const debt = (amount_pence: number): Amount => ({ amount_pence, type: 'debt' })

  it('adds savings and subtracts debts for net worth', () => {
    expect(signedValue(saving(500))).toBe(500)
    expect(signedValue(debt(500))).toBe(-500)
    expect(balance([saving(2000000), saving(50000), debt(18000000)])).toBe(-15950000)
  })

  it('totals each type separately', () => {
    const items = [saving(100), saving(250), debt(1000), income(7)]
    expect(typeTotal(items, 'saving')).toBe(350)
    expect(typeTotal(items, 'debt')).toBe(1000)
    expect(incomeTotal(items)).toBe(7)
  })

  it('treats a saving going up and a debt going down as good', () => {
    expect(isGoodChange('saving', 250)).toBe(true)
    expect(isGoodChange('saving', -250)).toBe(false)
    expect(isGoodChange('debt', -45000)).toBe(true)
    expect(isGoodChange('debt', 45000)).toBe(false)
    expect(isGoodChange('saving', 0)).toBe(false)
    expect(isGoodChange('debt', 0)).toBe(false)
  })

  it('colours savings like income and debts like expenses', () => {
    expect(typeColour('saving')).toBe('text-income')
    expect(typeColour('debt')).toBe('text-expense')
  })
})

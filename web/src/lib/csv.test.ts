import { describe, expect, it } from 'vitest'
import { csvField, csvFileName, CSV_COLUMNS, exportRows, toCsv } from './csv'
import type { Budget, Entry, Folder, Snapshot } from './pb'

const base = { collectionId: '', collectionName: '', created: '2026-01-01 00:00:00.000Z' }
const folder = (id: string, parent = '') => ({ ...base, id, name: id, parent, sort_order: 0 }) as Folder
const budget = (id: string, folder = '', kind: Budget['kind'] = '', sort_order = 0) =>
  ({ ...base, id, name: id, folder, kind, sort_order }) as Budget
const entry = (id: string, budget: string, amount_pence: number, type: Entry['type'], more: Partial<Entry> = {}) =>
  ({ ...base, id, budget, name: id, amount_pence, type, note: '', sort_order: 0, ...more }) as Entry
const snapshot = (entry: string, amount_pence: number, created: string) =>
  ({ ...base, id: `${entry}${created}`, entry, amount_pence, created }) as Snapshot

describe('csvField', () => {
  it('leaves plain text alone', () => {
    expect(csvField('Car insurance')).toBe('Car insurance')
    expect(csvField('')).toBe('')
  })

  it('quotes commas, quotes and line breaks', () => {
    expect(csvField('Rent, bills')).toBe('"Rent, bills"')
    expect(csvField('The "big" one')).toBe('"The ""big"" one"')
    expect(csvField('two\nlines')).toBe('"two\nlines"')
  })

  it("stops a spreadsheet running a name as a formula", () => {
    expect(csvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(csvField('+44 7700')).toBe("'+44 7700")
    expect(csvField('-refund')).toBe("'-refund")
    expect(csvField('@home')).toBe("'@home")
    expect(csvField('=1,2')).toBe('"\'=1,2"')
  })
})

describe('toCsv', () => {
  it('joins rows for Excel', () => {
    expect(toCsv([['a', 'b'], ['1', 'x,y']])).toBe('﻿a,b\r\n1,"x,y"\r\n')
  })
})

describe('exportRows', () => {
  const folders = [folder('Monthly'), folder('2026', 'Monthly')]
  const budgets = [budget('Worth', '', 'tracker', 1), budget('March', '2026'), budget('Loose', '', '', 0)]
  const entries = [
    entry('Salary', 'March', 320000, 'income'),
    entry('Rent', 'March', 90000, 'expense', { paid: true, note: 'Due 1st' }),
    entry('Free', 'Loose', 0, 'expense'),
    entry('Big', 'Loose', 123456789012, 'income'),
    entry('ISA', 'Worth', 1265000, 'saving'),
    entry('Loan', 'Worth', 500, 'debt'),
  ]
  const snapshots = [
    snapshot('ISA', 1265000, '2026-10-01 09:00:00.000Z'),
    snapshot('ISA', 1240000, '2026-09-01 09:00:00.000Z'),
  ]
  const data = { folders, budgets, entries, snapshots }

  it('starts with the headings', () => {
    expect(exportRows(data)[0]).toEqual(CSV_COLUMNS)
  })

  it('has a row per entry, top level first, with amounts in pounds from whole pence', () => {
    expect(exportRows(data).slice(1)).toEqual([
      ['', 'Loose', 'Budget', 'expense', 'Free', '0.00', '', '', ''],
      ['', 'Loose', 'Budget', 'income', 'Big', '1234567890.12', '', '', ''],
      ['', 'Worth', 'Savings & debts', 'saving', 'ISA', '12400.00', '', '', '2026-09-01'],
      ['', 'Worth', 'Savings & debts', 'saving', 'ISA', '12650.00', '', '', '2026-10-01'],
      // No history recorded: just its current value.
      ['', 'Worth', 'Savings & debts', 'debt', 'Loan', '5.00', '', '', ''],
      ['Monthly / 2026', 'March', 'Budget', 'income', 'Salary', '3200.00', '', '', ''],
      ['Monthly / 2026', 'March', 'Budget', 'expense', 'Rent', '900.00', 'yes', 'Due 1st', ''],
    ])
  })

  it('can export one budget', () => {
    const rows = exportRows(data, 'March')
    expect(rows).toHaveLength(3)
    expect(rows.slice(1).every((row) => row[1] === 'March')).toBe(true)
  })
})

describe('csvFileName', () => {
  it('is safe as a file name and dated', () => {
    expect(csvFileName('Monthly / March!', new Date(2026, 10, 9))).toBe('tally-monthly-march-2026-11-09.csv')
    expect(csvFileName('£££', new Date(2026, 0, 1))).toBe('tally-budget-2026-01-01.csv')
  })
})

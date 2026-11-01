import { describe, expect, it } from 'vitest'
import type { Budget, Entry, Folder, Snapshot } from './pb'
import {
  budgetBalance,
  cardsIn,
  changeSincePrevious,
  expectedValue,
  folderPath,
  historyOf,
  levelBalance,
  linkedInto,
  linkTarget,
  monthsBetween,
  nextSortOrder,
} from './selectors'

const base = { collectionId: '', collectionName: '', created: '2026-01-01' }
const folder = (id: string, parent = '', sort_order = 0) =>
  ({ ...base, id, name: id, parent, sort_order }) as Folder
const budget = (id: string, folder = '', sort_order = 0, kind: Budget['kind'] = '') =>
  ({ ...base, id, name: id, folder, sort_order, kind }) as Budget
const entry = (budget: string, amount_pence: number, type: Entry['type']) =>
  ({ ...base, id: `${budget}${amount_pence}`, budget, name: 'e', amount_pence, type, note: '', sort_order: 0 }) as Entry

describe('balances', () => {
  const budgets = [budget('root1'), budget('root2'), budget('inA', 'A'), budget('inSub', 'Sub')]
  const entries = [
    entry('root1', 1000, 'income'),
    entry('root2', 300, 'expense'),
    entry('inA', 5000, 'income'),
    entry('inSub', 70, 'expense'),
  ]

  it('computes one budget', () => {
    expect(budgetBalance(entries, 'root1')).toBe(1000)
    expect(budgetBalance(entries, 'root2')).toBe(-300)
    expect(budgetBalance(entries, 'empty')).toBe(0)
  })

  it('counts only root-level budgets at the root', () => {
    expect(levelBalance(budgets, entries, '')).toBe(700)
  })

  it('counts only budgets directly in a folder, not subfolders', () => {
    expect(levelBalance(budgets, entries, 'A')).toBe(5000)
    expect(levelBalance(budgets, entries, 'Sub')).toBe(-70)
  })
})

describe('cardsIn', () => {
  it('merges folders and budgets of one level into one order', () => {
    const cards = cardsIn(
      [folder('f1', '', 1), folder('other', 'f1', 0)],
      [budget('b0', '', 0), budget('b2', '', 2), budget('nested', 'f1', 0)],
      '',
    )
    expect(cards.map((c) => c.key)).toEqual(['budget:b0', 'folder:f1', 'budget:b2'])
  })
})

describe('nextSortOrder', () => {
  it('goes after the last item', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([{ sort_order: 4 }, { sort_order: 1 }])).toBe(5)
  })
})

describe('folderPath', () => {
  it('walks up through parents', () => {
    const folders = [folder('A'), folder('B', 'A'), folder('C', 'B')]
    expect(folderPath(folders, folders[2])).toBe('A / B / C')
  })

  it('survives a cycle', () => {
    const folders = [folder('A', 'B'), folder('B', 'A')]
    expect(folderPath(folders, folders[0])).toBe('B / A')
  })
})

describe('savings & debts budgets', () => {
  it("don't count towards All Budgets or Folder Balance", () => {
    const budgets = [budget('monthly'), budget('worth', '', 1, 'tracker'), budget('inA', 'A'), budget('worthA', 'A', 1, 'tracker')]
    const entries = [
      entry('monthly', 1000, 'income'),
      entry('worth', 2000000, 'saving'),
      entry('inA', 300, 'expense'),
      entry('worthA', 18000000, 'debt'),
    ]
    expect(levelBalance(budgets, entries, '')).toBe(1000)
    expect(levelBalance(budgets, entries, 'A')).toBe(-300)
    // The card itself still shows its net worth.
    expect(budgetBalance(entries, 'worthA')).toBe(-18000000)
  })
})

describe('history', () => {
  const snap = (id: string, entry: string, amount_pence: number, created: string) =>
    ({ ...base, id, entry, amount_pence, created }) as Snapshot
  const isa = { ...entry('worth', 260000, 'saving'), id: 'isa' }
  const snapshots = [
    snap('s1', 'isa', 200000, '2026-09-01 10:00:00.000Z'),
    snap('s3', 'isa', 260000, '2026-11-01 10:00:00.000Z'),
    snap('s2', 'isa', 235000, '2026-10-01 10:00:00.000Z'),
    snap('x', 'other', 1, '2026-12-01 10:00:00.000Z'),
  ]

  it('lists one item, newest first', () => {
    expect(historyOf(snapshots, 'isa').map((s) => s.id)).toEqual(['s3', 's2', 's1'])
  })

  it('compares the current value with the one before the latest update', () => {
    expect(changeSincePrevious(isa, snapshots)).toEqual({ change: 25000, since: '2026-10-01 10:00:00.000Z' })
  })

  it('has no change until there are two values', () => {
    expect(changeSincePrevious(isa, snapshots.slice(0, 1))).toBeNull()
    expect(changeSincePrevious(isa, [])).toBeNull()
  })
})

describe('links and expected values', () => {
  const budgets = [budget('household'), budget('worth', '', 1, 'tracker')]
  const item = (id: string, amount_pence: number, type: 'saving' | 'debt', created = '2026-09-01 00:00:00.000Z') =>
    ({ ...base, id, budget: 'worth', name: id, amount_pence, type, note: '', sort_order: 0, created }) as Entry
  const pay = (id: string, amount_pence: number, link: string, budgetId = 'household') =>
    ({ ...entry(budgetId, amount_pence, 'expense'), id, link }) as Entry
  const isa = item('isa', 1240000, 'saving')
  const mortgage = item('mortgage', 18230000, 'debt')
  const entries = [isa, mortgage, pay('toIsa', 25000, 'isa'), pay('extra', 5000, 'isa'), pay('mort', 115000, 'mortgage'), pay('gone', 999, 'isa', 'deletedBudget')]
  const snap = (entryId: string, amount_pence: number, created: string) =>
    ({ ...base, id: `${entryId}${created}`, entry: entryId, amount_pence, created }) as Snapshot
  const snapshots = [snap('isa', 1240000, '2026-10-01 09:00:00.000Z'), snap('mortgage', 18230000, '2026-10-15 09:00:00.000Z')]
  const nov = new Date(2026, 10, 1, 12)

  it('counts calendar months', () => {
    expect(monthsBetween('2026-10-15 09:00:00.000Z', nov)).toBe(1)
    expect(monthsBetween('2026-08-31 09:00:00.000Z', nov)).toBe(3)
    expect(monthsBetween('2025-12-01 09:00:00.000Z', nov)).toBe(11)
    expect(monthsBetween('2026-11-01 09:00:00.000Z', nov)).toBe(0)
  })

  it('finds links, ignoring ones from deleted budgets or to missing items', () => {
    expect(linkedInto(isa, entries, budgets).map((e) => e.id)).toEqual(['toIsa', 'extra'])
    expect(linkTarget(entries[2], entries, budgets)?.id).toBe('isa')
    expect(linkTarget(pay('x', 1, 'nothing'), entries, budgets)).toBeUndefined()
    expect(linkTarget(pay('x', 1, ''), entries, budgets)).toBeUndefined()
  })

  it('adds a month of linked payments to a saving', () => {
    expect(expectedValue(isa, entries, budgets, snapshots, nov)).toEqual({ pence: 1270000, monthly: 30000, months: 1 })
  })

  it('takes payments off a debt, one per month since the last value', () => {
    expect(expectedValue(mortgage, entries, budgets, snapshots, new Date(2027, 0, 5))).toEqual({
      pence: 18230000 - 3 * 115000,
      monthly: 115000,
      months: 3,
    })
  })

  it('never takes a debt below zero', () => {
    const small = item('small', 50000, 'debt')
    const result = expectedValue(small, [small, pay('p', 30000, 'small')], budgets, [], nov)
    expect(result?.pence).toBe(0)
  })

  it('suggests nothing without links or before a month has passed', () => {
    const unlinked = item('bonds', 500000, 'saving')
    expect(expectedValue(unlinked, [unlinked], budgets, [], nov)).toBeNull()
    expect(expectedValue(isa, entries, budgets, [snap('isa', 1240000, '2026-11-01 08:00:00.000Z')], nov)).toBeNull()
  })

  it('falls back to when the item was added if it has no history', () => {
    expect(expectedValue(isa, entries, budgets, [], nov)?.months).toBe(2)
  })
})

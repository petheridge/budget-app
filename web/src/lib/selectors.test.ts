import { describe, expect, it } from 'vitest'
import type { Budget, Entry, Folder, Snapshot } from './pb'
import {
  budgetBalance,
  cardsIn,
  changeSincePrevious,
  folderPath,
  historyOf,
  levelBalance,
  linkedInto,
  linkTarget,
  nextSortOrder,
  sortByAmount,
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

describe('links', () => {
  const budgets = [budget('household'), budget('worth', '', 1, 'tracker')]
  const item = (id: string, amount_pence: number, type: 'saving' | 'debt', created = '2026-09-01 00:00:00.000Z') =>
    ({ ...base, id, budget: 'worth', name: id, amount_pence, type, note: '', sort_order: 0, created }) as Entry
  const pay = (id: string, amount_pence: number, link: string, budgetId = 'household') =>
    ({ ...entry(budgetId, amount_pence, 'expense'), id, link }) as Entry
  const isa = item('isa', 1240000, 'saving')
  const entries = [isa, pay('toIsa', 25000, 'isa'), pay('extra', 5000, 'isa'), pay('mort', 115000, 'mortgage'), pay('gone', 999, 'isa', 'deletedBudget')]
  it('finds links, ignoring ones from deleted budgets or to missing items', () => {
    expect(linkedInto(isa, entries, budgets).map((e) => e.id)).toEqual(['toIsa', 'extra'])
    expect(linkTarget(entries[2], entries, budgets)?.id).toBe('isa')
    expect(linkTarget(pay('x', 1, 'nothing'), entries, budgets)).toBeUndefined()
    expect(linkTarget(pay('x', 1, ''), entries, budgets)).toBeUndefined()
  })

})

describe('sortByAmount', () => {
  const e = (id: string, amount_pence: number, type: Entry['type']) =>
    ({ ...entry('b', amount_pence, type), id }) as Entry
  const list = [e('food', 45000, 'expense'), e('salary', 320000, 'income'), e('mortgage', 248289, 'expense'), e('water', 7300, 'expense'), e('bonus', 50000, 'income'), e('tv', 7300, 'expense')]

  it('puts income first, then expenses, each largest first', () => {
    expect(sortByAmount(list, 'largest').map((x) => x.id)).toEqual(['salary', 'bonus', 'mortgage', 'food', 'water', 'tv'])
  })

  it('can go smallest first, keeping equal amounts in their current order', () => {
    expect(sortByAmount(list, 'smallest').map((x) => x.id)).toEqual(['bonus', 'salary', 'water', 'tv', 'food', 'mortgage'])
  })

  it('puts savings above debts', () => {
    const items = [e('mortgage', 18000000, 'debt'), e('isa', 1200000, 'saving')]
    expect(sortByAmount(items, 'largest').map((x) => x.id)).toEqual(['isa', 'mortgage'])
  })
})

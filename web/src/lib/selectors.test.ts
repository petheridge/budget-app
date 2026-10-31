import { describe, expect, it } from 'vitest'
import type { Budget, Entry, Folder } from './pb'
import { budgetBalance, cardsIn, folderPath, levelBalance, nextSortOrder } from './selectors'

const base = { collectionId: '', collectionName: '', created: '2026-01-01' }
const folder = (id: string, parent = '', sort_order = 0) =>
  ({ ...base, id, name: id, parent, sort_order }) as Folder
const budget = (id: string, folder = '', sort_order = 0) =>
  ({ ...base, id, name: id, folder, sort_order }) as Budget
const entry = (budget: string, amount_pence: number, type: 'income' | 'expense') =>
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

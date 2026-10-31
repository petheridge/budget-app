import { balance, sum, type Amount } from './money'
import type { Budget, Entry, Folder } from './pb'

export type Card =
  | { kind: 'folder'; key: string; record: Folder }
  | { kind: 'budget'; key: string; record: Budget }

interface Sortable {
  sort_order: number
  created: string
}

export function bySortOrder(a: Sortable, b: Sortable): number {
  return a.sort_order - b.sort_order || a.created.localeCompare(b.created)
}

/** The shared, ordered list of folders and budgets directly in a folder ('' = root). */
export function cardsIn(folders: Folder[], budgets: Budget[], folderId: string): Card[] {
  const cards: Card[] = [
    ...folders
      .filter((f) => f.parent === folderId)
      .map((record): Card => ({ kind: 'folder', key: `folder:${record.id}`, record })),
    ...budgets
      .filter((b) => b.folder === folderId)
      .map((record): Card => ({ kind: 'budget', key: `budget:${record.id}`, record })),
  ]
  return cards.sort((a, b) => bySortOrder(a.record, b.record))
}

export function entriesIn(entries: Entry[], budgetId: string): Entry[] {
  return entries.filter((e) => e.budget === budgetId)
}

export function budgetBalance(entries: Entry[], budgetId: string): number {
  return balance(entriesIn(entries, budgetId) as Amount[])
}

/**
 * Sum of the balances of budgets directly in a folder ('' = root).
 * Budgets in folders deliberately don't count towards the level above.
 */
export function levelBalance(budgets: Budget[], entries: Entry[], folderId: string): number {
  return sum(budgets.filter((b) => b.folder === folderId).map((b) => budgetBalance(entries, b.id)))
}

export function nextSortOrder(items: { sort_order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sort_order + 1), 0)
}

/** e.g. "Monthly / Bills", for telling subfolders apart when picking one. */
export function folderPath(folders: Folder[], folder: Folder): string {
  const names = [folder.name]
  const seen = new Set([folder.id])
  let parent = folders.find((f) => f.id === folder.parent)
  while (parent && !seen.has(parent.id)) {
    names.unshift(parent.name)
    seen.add(parent.id)
    parent = folders.find((f) => f.id === parent?.parent)
  }
  return names.join(' / ')
}

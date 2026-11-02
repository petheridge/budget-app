import { balance, isPositive, sum, type Amount } from './money'
import { isTracker, type Budget, type Entry, type Folder, type Snapshot } from './pb'

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
 * Budgets in folders deliberately don't count towards the level above, and
 * savings & debts budgets don't count at all: they're net worth, not monthly money.
 */
export function levelBalance(budgets: Budget[], entries: Entry[], folderId: string): number {
  return sum(
    budgets
      .filter((b) => b.folder === folderId && !isTracker(b))
      .map((b) => budgetBalance(entries, b.id)),
  )
}

/** An item's recorded values, newest first. */
export function historyOf(snapshots: Snapshot[], entryId: string): Snapshot[] {
  return snapshots
    .filter((s) => s.entry === entryId)
    .sort((a, b) => b.created.localeCompare(a.created))
}

/**
 * How an item's current value differs from the value recorded before its latest
 * update, and when that was. Null until it has at least two recorded values.
 */
export function changeSincePrevious(
  entry: Entry,
  snapshots: Snapshot[],
): { change: number; since: string } | null {
  const previous = historyOf(snapshots, entry.id)[1]
  return previous ? { change: entry.amount_pence - previous.amount_pence, since: previous.created } : null
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

/** The saving or debt a budget expense is linked to, if it still exists. */
export function linkTarget(entry: Entry, entries: Entry[], budgets: Budget[]): Entry | undefined {
  if (!entry.link) return undefined
  const target = entries.find((e) => e.id === entry.link)
  return target && budgets.some((b) => b.id === target.budget) ? target : undefined
}

/** Budget expenses linked to a saving or debt, from budgets that still exist. */
export function linkedInto(item: Entry, entries: Entry[], budgets: Budget[]): Entry[] {
  return entries.filter((e) => e.link === item.id && budgets.some((b) => b.id === e.budget))
}

/**
 * Entries sorted by amount, for "Sort by amount" in a budget's menu. Income (or
 * savings) stays above expenses (or debts), each sorted largest or smallest
 * first; equal amounts keep their current order.
 */
export function sortByAmount(entries: Entry[], order: 'largest' | 'smallest'): Entry[] {
  const direction = order === 'largest' ? -1 : 1
  return [...entries].sort(
    (a, b) =>
      Number(isPositive(b.type)) - Number(isPositive(a.type)) ||
      direction * (a.amount_pence - b.amount_pence),
  )
}

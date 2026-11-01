import { balance, sum, type Amount } from './money'
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

/** Whole calendar months from a recorded date to now: 15 Oct to 1 Nov is 1. */
export function monthsBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso.replace(' ', 'T'))
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
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
 * What a saving or debt should be worth now, from the monthly amounts linked to
 * it: one payment for each calendar month since its last recorded value, added
 * to a saving or taken off a debt (never below £0). A suggestion for Catch Up,
 * never stored. Null when nothing is linked or no month has passed.
 */
export function expectedValue(
  item: Entry,
  entries: Entry[],
  budgets: Budget[],
  snapshots: Snapshot[],
  now: Date,
): { pence: number; monthly: number; months: number } | null {
  const monthly = sum(linkedInto(item, entries, budgets).map((e) => e.amount_pence))
  if (monthly === 0) return null
  const since = historyOf(snapshots, item.id)[0]?.created ?? item.created
  const months = monthsBetween(since, now)
  if (months <= 0) return null
  const change = months * monthly
  const pence = item.type === 'debt' ? Math.max(0, item.amount_pence - change) : item.amount_pence + change
  return { pence, monthly, months }
}

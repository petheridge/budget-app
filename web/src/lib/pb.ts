import PocketBase, { type RecordModel, type RecordService } from 'pocketbase'
import type { EntryType } from './money'

export interface Folder extends RecordModel {
  name: string
  parent: string
  sort_order: number
  created: string
}

/** '' (older records) and 'budget' both mean an income/expense budget. */
export type BudgetKind = '' | 'budget' | 'tracker'

export interface Budget extends RecordModel {
  name: string
  folder: string
  kind: BudgetKind
  sort_order: number
  created: string
}

export interface Entry extends RecordModel {
  budget: string
  name: string
  amount_pence: number
  type: EntryType
  note: string
  /** For a budget expense: the saving or debt it pays into ('' for none). */
  link?: string
  sort_order: number
  created: string
}

/** A saving's or debt's value as recorded on a date (its created time). */
export interface Snapshot extends RecordModel {
  entry: string
  amount_pence: number
  created: string
}

export function isTracker(budget: Budget): boolean {
  return budget.kind === 'tracker'
}

interface TypedPocketBase extends PocketBase {
  collection(name: 'folders'): RecordService<Folder>
  collection(name: 'budgets'): RecordService<Budget>
  collection(name: 'entries'): RecordService<Entry>
  collection(name: 'snapshots'): RecordService<Snapshot>
  collection(name: string): RecordService
}

// Same origin in both setups: Vite proxies /api in dev, PocketBase serves the app in production.
export const pb = new PocketBase('/') as TypedPocketBase

// Otherwise the SDK cancels overlapping identical requests, such as a refresh during a refresh.
pb.autoCancellation(false)

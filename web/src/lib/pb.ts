import PocketBase, { type RecordModel, type RecordService } from 'pocketbase'
import type { EntryType } from './money'

export interface Folder extends RecordModel {
  name: string
  parent: string
  sort_order: number
  created: string
}

export interface Budget extends RecordModel {
  name: string
  folder: string
  sort_order: number
  created: string
}

export interface Entry extends RecordModel {
  budget: string
  name: string
  amount_pence: number
  type: EntryType
  note: string
  sort_order: number
  created: string
}

interface TypedPocketBase extends PocketBase {
  collection(name: 'folders'): RecordService<Folder>
  collection(name: 'budgets'): RecordService<Budget>
  collection(name: 'entries'): RecordService<Entry>
  collection(name: string): RecordService
}

// Same origin in both setups: Vite proxies /api in dev, PocketBase serves the app in production.
export const pb = new PocketBase('/') as TypedPocketBase

// Otherwise the SDK cancels overlapping identical requests, such as a refresh during a refresh.
pb.autoCancellation(false)

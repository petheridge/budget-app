// The app's data as a CSV file, for keeping a copy that can be read without the app.

import { penceToInput } from './money'
import { isTracker, type Budget, type Entry, type Folder, type Snapshot } from './pb'
import { bySortOrder, folderPath, historyOf } from './selectors'

export const CSV_COLUMNS = ['Folder', 'Budget', 'Kind', 'Type', 'Name', 'Amount', 'Paid', 'Note', 'Date']

/**
 * One field. Quoted when it holds a comma, quote or line break. Text that a
 * spreadsheet would run as a formula (starting = + - @) gets a leading ' so it's
 * shown as typed instead.
 */
export function csvField(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Rows as CSV text, with the line endings and leading mark that Excel expects. */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

interface Data {
  folders: Folder[]
  budgets: Budget[]
  entries: Entry[]
  snapshots: Snapshot[]
}

/**
 * A header row, then a row per budget entry. A saving or debt has a row for each
 * value in its history, oldest first, with the date it was recorded (UTC), so the
 * last is its current value. Amounts are plain numbers of pounds ("1234.56"),
 * written from whole pence. For one budget, or all of them.
 */
export function exportRows({ folders, budgets, entries, snapshots }: Data, budgetId?: string): string[][] {
  const rows = [CSV_COLUMNS]
  const chosen = budgets
    .filter((b) => !budgetId || b.id === budgetId)
    .map((budget) => {
      const folder = folders.find((f) => f.id === budget.folder)
      return { budget, path: folder ? folderPath(folders, folder) : '' }
    })
    .sort((a, b) => a.path.localeCompare(b.path) || bySortOrder(a.budget, b.budget))
  for (const { budget, path } of chosen) {
    const tracker = isTracker(budget)
    const kind = tracker ? 'Savings & debts' : 'Budget'
    const line = (entry: Entry, pence: number, date: string) => [
      path,
      budget.name,
      kind,
      entry.type,
      entry.name,
      penceToInput(pence),
      entry.paid ? 'yes' : '',
      entry.note,
      date,
    ]
    for (const entry of entries.filter((e) => e.budget === budget.id)) {
      const history = tracker ? historyOf(snapshots, entry.id).reverse() : []
      if (history.length === 0) rows.push(line(entry, entry.amount_pence, ''))
      for (const snapshot of history) rows.push(line(entry, snapshot.amount_pence, snapshot.created.slice(0, 10)))
    }
  }
  return rows
}

/**
 * Hands a file to the person. As an iPhone home-screen app a download link does
 * nothing useful, so there it goes to the share sheet (Save to Files, AirDrop…);
 * in a browser it downloads.
 */
export async function saveFile(name: string, text: string): Promise<void> {
  const file = new File([text], name, { type: 'text/csv' })
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  if (standalone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (error) {
      // Closing the share sheet without choosing isn't a failure.
      if ((error as Error).name !== 'AbortError') throw error
    }
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "tally-monthly-2026-11-09.csv" */
export function csvFileName(what: string, today = new Date()): string {
  const slug = what.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'budget'
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return `tally-${slug}-${day}.csv`
}

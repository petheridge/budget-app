import type { EntryType } from './money'

/** Wording for each entry type. Colours come from typeColour in money.ts. */
export const entryTypeLabels: Record<EntryType, { noun: string; example: string; amount: string }> = {
  income: { noun: 'Income', example: 'E.g. Salary', amount: 'Amount' },
  expense: { noun: 'Expense', example: 'E.g. Rent', amount: 'Amount' },
  saving: { noun: 'Saving', example: 'E.g. Cash ISA', amount: 'Current value' },
  debt: { noun: 'Debt', example: 'E.g. Mortgage', amount: 'Amount owed' },
}

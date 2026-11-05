import type { EntryType } from './money'

/** Wording for each entry type. Colours come from typeColour in money.ts. */
export const entryTypeLabels: Record<EntryType, { noun: string; plural: string; example: string; amount: string }> = {
  income: { noun: 'Income', plural: 'Income', example: 'E.g. Salary', amount: 'Amount' },
  expense: { noun: 'Expense', plural: 'Expenses', example: 'E.g. Rent', amount: 'Amount' },
  saving: { noun: 'Saving', plural: 'Savings', example: 'E.g. Cash ISA', amount: 'Current value' },
  debt: { noun: 'Debt', plural: 'Debts', example: 'E.g. Mortgage', amount: 'Amount owed' },
}

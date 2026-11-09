import { readFile } from 'node:fs/promises'
import { devices, expect, test } from '@playwright/test'
import { addBudget, addBudgetHere, addFolder, addRow, BASE_URL, rowNames, signIn, unique } from './helpers'

// Duplicating, exporting, moving things between budgets and folders, paid ticks,
// and reordering from a keyboard.

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await signIn(page)
})

test.afterEach(() => {
  expect(pageErrors, 'errors in the page').toEqual([])
})

const toRoot = async (page: import('@playwright/test').Page) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
}

test('duplicates a budget with its entries, notes and links', async ({ page }) => {
  const worth = unique('Net worth')
  const name = unique('March')
  await addBudget(page, worth, 'Savings & debts')
  await addRow(page, 'Add Saving', 'Cash ISA', '1', '0', '0', '0')
  // A savings & debts budget can't be duplicated.
  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await toRoot(page)
  await addBudget(page, name)
  await addRow(page, 'Add Income', 'Salary', '3', '2', '0', '0')
  await addRow(page, 'Add Income', 'Bonus', '2', '0', '0')
  await addRow(page, 'Add Expense', 'Rent', '9', '0', '0')
  await addRow(page, 'Add Expense', 'To ISA', '2', '5', '0')
  await page.getByRole('button', { name: 'Options for Rent' }).tap()
  await page.getByRole('menuitem', { name: 'Add note' }).tap()
  await page.getByLabel('Note for Rent').fill('Due on the 1st')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Options for Rent' }).tap()
  await page.getByRole('menuitem', { name: 'Mark as paid' }).tap()
  await page.getByRole('button', { name: 'Options for To ISA' }).tap()
  await page.getByRole('menuitem', { name: 'Link to saving or debt' }).tap()
  await page.locator('main').getByRole('button', { name: /^Cash ISA/ }).last().tap()
  await expect(page.locator('main')).toContainText('→ Cash ISA')

  await toRoot(page)
  await page.getByRole('button', { name: `Options for ${name}` }).tap()
  await page.getByRole('menuitem', { name: 'Duplicate' }).tap()
  // The copy's name is ready to change.
  const box = page.getByLabel(`Name for ${name} copy`)
  await expect(box).toBeFocused()
  await box.fill(`${name} next`)
  await page.keyboard.press('Enter')
  const copy = page.getByRole('link', { name: new RegExp(`${name} next`) })
  await expect(copy).toContainText('+ £ 2,250.00')
  await expect(page.getByRole('link', { name: new RegExp(`${name} `) })).toHaveCount(2)

  await copy.tap()
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Bonus', 'Rent', 'To ISA'])
  const main = page.locator('main')
  await expect(main).toContainText('+ £ 2,250.00')
  await expect(main).toContainText('Due on the 1st')
  await expect(main).toContainText('→ Cash ISA')
  // A copy is usually next month's, so nothing in it is paid yet.
  await expect(main).not.toContainText('✓ Paid')

  // From a budget's own screen, the copy opens.
  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await page.getByRole('menuitem', { name: 'Duplicate' }).tap()
  await expect(page.getByLabel(`Name for ${name} next copy`)).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('header h1')).toHaveText(`${name} next copy`)
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Bonus', 'Rent', 'To ISA'])
})

test('exports a budget, and everything, as CSV', async ({ page }) => {
  const folder = unique('Year')
  const name = unique('April')
  const worth = unique('Worth')
  await addFolder(page, folder)
  await page.getByRole('link', { name: new RegExp(folder) }).tap()
  await addBudget(page, name)
  await addRow(page, 'Add Income', 'Salary', '3', '2', '0', '0')
  await addRow(page, 'Add Expense', 'Rent, and bills', '9', '0', '0', 'point', '5')
  await addRow(page, 'Add Expense', '=SUM(A1)', '1')

  const lines = async (download: import('@playwright/test').Download) =>
    (await readFile(await download.path(), 'utf8')).replace(/^﻿/, '').trimEnd().split('\r\n')

  await page.getByRole('button', { name: 'Budget menu' }).tap()
  const [one] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export as CSV' }).tap(),
  ])
  expect(one.suggestedFilename()).toMatch(/^tally-april-[a-z0-9]+-\d{4}-\d\d-\d\d\.csv$/)
  expect(await lines(one)).toEqual([
    'Folder,Budget,Kind,Type,Name,Amount,Paid,Note,Date',
    `${folder},${name},Budget,income,Salary,3200.00,,,`,
    `${folder},${name},Budget,expense,"Rent, and bills",900.50,,,`,
    `${folder},${name},Budget,expense,'=SUM(A1),1.00,,,`,
  ])

  await toRoot(page)
  await addBudget(page, worth, 'Savings & debts')
  await addRow(page, 'Add Saving', 'Cash ISA', '1', '0', '0', '0')
  await toRoot(page)
  await page.getByRole('button', { name: 'Menu' }).tap()
  const [all] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Export as CSV' }).tap(),
  ])
  const everything = await lines(all)
  expect(everything).toContain(`${folder},${name},Budget,income,Salary,3200.00,,,`)
  // A saving has its dated history.
  expect(everything.some((line) => new RegExp(`^,${worth},Savings & debts,saving,Cash ISA,1000.00,,,\\d{4}-\\d\\d-\\d\\d$`).test(line))).toBe(true)
})

test('moves an entry to another budget', async ({ page }) => {
  const from = unique('From')
  const to = unique('To')
  const worth = unique('Worth')
  await addBudgetHere(page, to)
  await addBudget(page, worth, 'Savings & debts')
  await addRow(page, 'Add Saving', 'Cash ISA', '1', '0', '0', '0')
  await toRoot(page)
  await addBudget(page, from)
  await addRow(page, 'Add Expense', 'Gym', '3', '0')
  await addRow(page, 'Add Expense', 'To ISA', '2', '5', '0')
  await page.getByRole('button', { name: 'Options for To ISA' }).tap()
  await page.getByRole('menuitem', { name: 'Link to saving or debt' }).tap()
  await page.locator('main').getByRole('button', { name: /^Cash ISA/ }).last().tap()
  await expect(page.locator('main')).toContainText('- £ 280.00')

  await page.getByRole('button', { name: 'Options for To ISA' }).tap()
  await page.getByRole('menuitem', { name: 'Move to budget' }).tap()
  // Only budgets of the same kind are offered, with a tick on where it is now.
  await expect(page.getByRole('menuitemradio', { name: from })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', { name: worth })).toHaveCount(0)
  await page.getByRole('menuitemradio', { name: to }).tap()
  await expect(page.locator('main')).not.toContainText('To ISA')
  await expect(page.locator('main')).toContainText('- £ 30.00')

  await toRoot(page)
  await page.getByRole('link', { name: new RegExp(to) }).tap()
  await expect(page.locator('main')).toContainText('- £ 250.00')
  // Its link came with it.
  await expect(page.locator('main')).toContainText('→ Cash ISA')

  // A saving keeps its history when it moves.
  const other = unique('Other worth')
  await toRoot(page)
  await addBudgetHere(page, other, 'Savings & debts')
  await page.getByRole('link', { name: new RegExp(worth) }).tap()
  await page.getByRole('button', { name: 'Options for Cash ISA' }).tap()
  await page.getByRole('menuitem', { name: 'Move to budget' }).tap()
  await page.getByRole('menuitemradio', { name: other }).tap()
  await expect(page.locator('main')).not.toContainText('Cash ISA')
  await toRoot(page)
  await page.getByRole('link', { name: new RegExp(other) }).tap()
  await expect(page.locator('main')).toContainText('£ 250.00 a month from')
  await page.getByRole('button', { name: 'Options for Cash ISA' }).tap()
  await page.getByRole('menuitem', { name: 'History' }).tap()
  await expect(page.locator('main li')).toHaveCount(1)
  await expect(page.locator('main li')).toContainText('£ 1,000.00')
})

test('moves a folder into another folder and back', async ({ page }) => {
  const outer = unique('Outer')
  const inner = unique('Inner')
  const other = unique('Other')
  for (const name of [outer, inner, other]) await addFolder(page, name)

  await page.getByRole('button', { name: `Options for ${inner}` }).tap()
  await page.getByRole('menuitem', { name: 'Move to folder' }).tap()
  await expect(page.getByRole('menuitemradio', { name: 'Budgets (top level)' })).toHaveAttribute('aria-checked', 'true')
  // A folder can't go into itself.
  await expect(page.getByRole('menuitemradio', { name: inner })).toHaveCount(0)
  await page.getByRole('menuitemradio', { name: outer }).tap()
  await expect(page.getByRole('link', { name: new RegExp(inner) })).toHaveCount(0)

  // Nor into a folder inside it.
  await page.getByRole('button', { name: `Options for ${outer}` }).tap()
  await page.getByRole('menuitem', { name: 'Move to folder' }).tap()
  await expect(page.getByRole('menuitemradio', { name: other })).toBeVisible()
  await expect(page.getByRole('menuitemradio', { name: new RegExp(outer) })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('link', { name: new RegExp(outer) }).tap()
  await page.getByRole('button', { name: `Options for ${inner}` }).tap()
  await page.getByRole('menuitem', { name: 'Move to folder' }).tap()
  await expect(page.getByRole('menuitemradio', { name: outer, exact: true })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('menuitemradio', { name: 'Budgets (top level)' }).tap()
  await expect(page.getByRole('link', { name: new RegExp(inner) })).toHaveCount(0)
  await toRoot(page)
  await expect(page.getByRole('link', { name: new RegExp(inner) })).toBeVisible()
})

test('ticks an expense off as paid, here and on another phone', async ({ page, browser }) => {
  const name = unique('Monthly')
  await addBudget(page, name)
  await addRow(page, 'Add Income', 'Salary', '1', '0', '0', '0')
  await addRow(page, 'Add Expense', 'Rent', '6', '0', '0')
  await addRow(page, 'Add Expense', 'Food', '1', '5', '0')
  const main = page.locator('main')
  await expect(main).toContainText('+ £ 250.00')
  await expect(main).not.toContainText('Left to pay')

  // Only expenses can be paid.
  await page.getByRole('button', { name: 'Options for Salary' }).tap()
  await expect(page.getByRole('menuitem', { name: 'Add note' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: /Mark as/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Options for Rent' }).tap()
  await page.getByRole('menuitem', { name: 'Mark as paid' }).tap()
  const rent = main.locator('li').filter({ hasText: 'Rent' })
  await expect(rent).toContainText('✓ Paid')
  await expect(main).toContainText('Left to pay £ 150.00')
  // The balance is the plan, paid or not.
  await expect(main).toContainText('+ £ 250.00')

  await page.reload()
  await expect(rent).toContainText('✓ Paid')

  const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: BASE_URL })
  const phone = await context.newPage()
  await signIn(phone)
  await phone.getByRole('link', { name: new RegExp(name) }).tap()
  const rentThere = phone.locator('main li').filter({ hasText: 'Rent' })
  await expect(rentThere).toContainText('✓ Paid')

  await page.getByRole('button', { name: 'Options for Rent' }).tap()
  await page.getByRole('menuitem', { name: 'Mark as unpaid' }).tap()
  await expect(rent).not.toContainText('✓ Paid')
  await expect(main).not.toContainText('Left to pay')
  await expect(rentThere).not.toContainText('✓ Paid')
  await context.close()
})

test('reorders rows from a keyboard', async ({ page }) => {
  await addBudget(page, unique('Fixed'))
  await addRow(page, 'Add Expense', 'Water', '7', '3')
  await addRow(page, 'Add Expense', 'Mortgage', '2', '4', '8', '2')
  await addRow(page, 'Add Expense', 'Phone', '2', '0')
  await expect.poll(() => rowNames(page)).toEqual(['Water', 'Mortgage', 'Phone'])

  // At the pace of a person: each key acts on where the last one left the row.
  await page.locator('main li').nth(2).focus()
  for (const key of ['Space', 'ArrowUp', 'ArrowUp', 'Space']) {
    await page.keyboard.press(key)
    await page.waitForTimeout(250)
  }
  await expect.poll(() => rowNames(page)).toEqual(['Phone', 'Water', 'Mortgage'])

  // Space on a button inside a row presses the button; it doesn't pick the row up.
  // (The click straight after a drop is ignored for a moment, as after a drag by touch.)
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Options for Water' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.reload()
  await expect.poll(() => rowNames(page)).toEqual(['Phone', 'Water', 'Mortgage'])
})

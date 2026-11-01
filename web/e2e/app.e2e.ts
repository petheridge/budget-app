import { expect, test, type Page } from '@playwright/test'
import { addBudget, addRow, holdAndDrag, keypad, pressKeys, rowNames, signIn, unique } from './helpers'

const undoMessage = (page: Page) => page.getByRole('status').filter({ hasText: 'Deleted' })

// Any uncaught error in the page fails the test. Tests run one at a time.
let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await signIn(page)
})

test.afterEach(() => {
  expect(pageErrors, 'errors in the page').toEqual([])
})

test('adds entries inline, with sums on the keypad', async ({ page }) => {
  await addBudget(page, unique('Monthly'))
  await addRow(page, 'Add Income', 'Salary', '3', '2', '0', '0')
  await page.getByRole('button', { name: 'Add Expense' }).tap()
  await page.keyboard.type('Car insurance')
  await page.keyboard.press('Enter')
  await pressKeys(page, '5', '7', '6', 'divide', '1', '2')
  await expect(keypad(page)).toContainText('= £ 48.00')
  await keypad(page).getByRole('button', { name: 'Save' }).tap()

  await expect(page.locator('main')).toContainText('- £ 48.00')
  await expect(page.locator('footer')).toContainText('+ £ 3,152.00')
})

test('refuses a sum below zero and explains why', async ({ page }) => {
  await addBudget(page, unique('Monthly'))
  await page.getByRole('button', { name: 'Add Expense' }).tap()
  await page.keyboard.type('Oops')
  await page.keyboard.press('Enter')
  await pressKeys(page, '5', 'minus', '1', '0')
  await keypad(page).getByRole('button', { name: 'Save' }).tap()
  await expect(keypad(page)).toContainText("Can't be less than £ 0.00")
})

test('changes an amount and a name in place', async ({ page }) => {
  const name = unique('Monthly')
  await addBudget(page, name)
  await addRow(page, 'Add Expense', 'Energy', '1', '4', '0')

  await page.getByRole('button', { name: 'Energy amount' }).tap()
  await pressKeys(page, 'plus', '1', '0')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()
  await expect(page.locator('main')).toContainText('- £ 150.00')

  await page.getByRole('button', { name: 'Rename Energy' }).tap()
  await page.getByLabel('Name for Energy').fill('Electricity')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Rename Electricity' })).toBeVisible()

  // A blank name puts the old one back.
  await page.getByRole('button', { name: 'Rename Electricity' }).tap()
  await page.getByLabel('Name for Electricity').fill('  ')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Rename Electricity' })).toBeVisible()

  // Reloading keeps the same screen.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Rename Electricity' })).toBeVisible()
})

test('deleting an entry can be undone, and is final after a few seconds', async ({ page }) => {
  const name = unique('Monthly')
  await addBudget(page, name)
  await addRow(page, 'Add Expense', 'Water', '7', '3')
  await addRow(page, 'Add Expense', 'Broadband', '4', '5')

  await page.getByRole('button', { name: 'Options for Water' }).tap()
  await page.getByRole('button', { name: 'Delete' }).tap()
  await expect(undoMessage(page)).toContainText('Deleted “Water”')
  await expect(page.locator('main')).not.toContainText('Water')
  await page.getByRole('button', { name: 'Undo' }).tap()
  await expect(page.locator('main')).toContainText('Water')

  await page.getByRole('button', { name: 'Options for Broadband' }).tap()
  await page.getByRole('button', { name: 'Delete' }).tap()
  await expect(undoMessage(page)).toBeHidden({ timeout: 10_000 })
  await page.reload()
  await expect(page.locator('main')).toContainText('Water')
  await expect(page.locator('main')).not.toContainText('Broadband')
})

test('deleting a budget asks first, and can be undone with its entries', async ({ page }) => {
  const name = unique('Holiday')
  await addBudget(page, name)
  await addRow(page, 'Add Expense', 'Flights', '1', '2', '0')
  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await page.getByRole('button', { name: 'Delete' }).tap()
  await page.getByRole('button', { name: 'Delete Budget' }).tap()

  await expect(undoMessage(page)).toContainText(`Deleted “${name}” and its entry`)
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeHidden()
  await page.getByRole('button', { name: 'Undo' }).tap()
  await page.getByRole('link', { name: new RegExp(name) }).tap()
  await expect(page.locator('main')).toContainText('Flights')
})

test('press and hold to reorder, and sort by amount', async ({ page }) => {
  const name = unique('Fixed')
  await addBudget(page, name)
  await addRow(page, 'Add Expense', 'Water', '7', '3')
  await addRow(page, 'Add Expense', 'Mortgage', '2', '4', '8', '2')
  await addRow(page, 'Add Income', 'Salary', '3', '2', '0', '0')

  await holdAndDrag(page, page.locator('main li').nth(2), page.locator('main li').nth(0))
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Water', 'Mortgage'])
  // Letting go after the drag isn't a tap on the amount.
  await expect(keypad(page)).toBeHidden()

  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await page.getByRole('button', { name: 'Sort by amount' }).tap()
  await page.getByRole('button', { name: 'Largest first' }).tap()
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Mortgage', 'Water'])

  await page.reload()
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Mortgage', 'Water'])
})

test('savings & debts: link a payment, catch up and see the history', async ({ page }) => {
  const worth = unique('Net worth')
  const allBudgetsBalance = await page.locator('footer').innerText()
  await addBudget(page, worth, 'Savings & debts')
  await addRow(page, 'Add Saving', 'Cash ISA', '1', '2', '4', '0', '0')
  await addRow(page, 'Add Debt', 'Mortgage', '1', '8', '0', '0', '0', '0')
  await expect(page.locator('footer')).toContainText('- £ 167,600.00')

  await page.getByRole('link', { name: /Budgets/ }).first().tap()
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
  // Net worth isn't money in and out, so it isn't in All Budgets Balance.
  expect(await page.locator('footer').innerText()).toBe(allBudgetsBalance)
  await addBudget(page, unique('Household'))
  await addRow(page, 'Add Expense', 'To ISA', '2', '5', '0')
  await page.getByRole('button', { name: 'Options for To ISA' }).tap()
  await page.getByRole('button', { name: 'Link to saving or debt' }).tap()
  await page.getByRole('dialog').getByRole('button', { name: /^Cash ISA/ }).last().tap()
  await expect(page.locator('main')).toContainText('→ Cash ISA')

  await page.getByRole('link', { name: /Budgets/ }).first().tap()
  await page.getByRole('link', { name: new RegExp(worth) }).tap()
  await expect(page.locator('main')).toContainText('£ 250.00 a month from')

  await page.getByRole('link', { name: 'Catch Up' }).tap()
  await page.getByRole('button', { name: 'Cash ISA value' }).tap()
  await pressKeys(page, 'plus', '2', '5', '0')
  await keypad(page).getByRole('button', { name: 'Next' }).tap()
  await pressKeys(page, 'minus', '4', '5', '0')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()
  await page.getByRole('button', { name: 'Save Catch-Up' }).tap()

  await expect(page.locator('main')).toContainText('£ 12,650.00')
  await expect(page.locator('main')).toContainText('▲ £ 250.00 since')
  await expect(page.locator('main')).toContainText('▼ £ 450.00 since')
  await page.getByRole('button', { name: 'Options for Mortgage' }).tap()
  await page.getByRole('button', { name: 'History' }).tap()
  await expect(page.getByRole('dialog')).toContainText('£ 180,000.00')
  await expect(page.getByRole('dialog')).toContainText('£ 179,550.00')
})

test('only the list scrolls; the page itself is pinned', async ({ page }) => {
  const pinned = await page.evaluate(() => {
    window.scrollTo(0, 500)
    return document.scrollingElement!.scrollTop === 0 && document.scrollingElement!.scrollHeight <= innerHeight
  })
  expect(pinned).toBe(true)
})

test('follows the phone in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await addBudget(page, unique('Monthly'))
  await addRow(page, 'Add Expense', 'Water', '7', '3')
  const colours = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!)
    const addIncome = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Add Income')!
    return {
      header: style('header').backgroundColor,
      row: getComputedStyle(document.querySelector('main li > div')!).backgroundColor,
      button: getComputedStyle(addIncome).backgroundColor,
    }
  })
  expect(colours.header).toBe('rgb(47, 42, 110)')
  expect(colours.row).toBe('rgb(37, 39, 45)')
  // Buttons are outlined in dark mode.
  expect(colours.button).toBe('rgba(0, 0, 0, 0)')
})

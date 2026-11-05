import { expect, test, type Page } from '@playwright/test'
import {
  addBudget,
  addBudgetHere,
  addFolder,
  addRow,
  holdAndDrag,
  keypad,
  pressKeys,
  rowNames,
  signIn,
  swipe,
  unique,
} from './helpers'

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
  // The balance, at the top of the screen.
  await expect(page.locator('main')).toContainText('+ £ 3,152.00')
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
  await page.getByRole('menuitem', { name: 'Delete' }).tap()
  await expect(undoMessage(page)).toContainText('Deleted “Water”')
  await expect(page.locator('main')).not.toContainText('Water')
  await page.getByRole('button', { name: 'Undo' }).tap()
  await expect(page.locator('main')).toContainText('Water')

  await page.getByRole('button', { name: 'Options for Broadband' }).tap()
  await page.getByRole('menuitem', { name: 'Delete' }).tap()
  await expect(undoMessage(page)).toBeHidden({ timeout: 10_000 })
  await page.reload()
  await expect(page.locator('main')).toContainText('Water')
  await expect(page.locator('main')).not.toContainText('Broadband')
})

test('deleting a budget can be undone, with its entries', async ({ page }) => {
  const name = unique('Holiday')
  await addBudget(page, name)
  await addRow(page, 'Add Expense', 'Flights', '1', '2', '0')
  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await page.getByRole('menuitem', { name: 'Delete' }).tap()

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

  // Income comes first, in its own section; rows move within their section.
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Water', 'Mortgage'])
  await holdAndDrag(page, page.locator('main li').nth(2), page.locator('main li').nth(1))
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Mortgage', 'Water'])
  // Letting go after the drag isn't a tap on the amount.
  await expect(keypad(page)).toBeHidden()

  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await page.getByRole('menuitem', { name: 'Sort by amount' }).tap()
  await page.getByRole('menuitem', { name: 'Smallest first' }).tap()
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Water', 'Mortgage'])

  await page.reload()
  await expect.poll(() => rowNames(page)).toEqual(['Salary', 'Water', 'Mortgage'])
})

test('savings & debts: link a payment, update values and see the history', async ({ page }) => {
  const worth = unique('Net worth')
  const allBudgetsBalance = await page.locator('footer').innerText()
  await addBudget(page, worth, 'Savings & debts')
  await addRow(page, 'Add Saving', 'Cash ISA', '1', '2', '4', '0', '0')
  await addRow(page, 'Add Debt', 'Mortgage', '1', '8', '0', '0', '0', '0')
  await expect(page.locator('main')).toContainText('- £ 167,600.00')

  await page.getByRole('link', { name: /Budgets/ }).first().tap()
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
  // Net worth isn't money in and out, so it isn't in All Budgets Balance.
  expect(await page.locator('footer').innerText()).toBe(allBudgetsBalance)
  await addBudget(page, unique('Household'))
  await addRow(page, 'Add Expense', 'To ISA', '2', '5', '0')
  await page.getByRole('button', { name: 'Options for To ISA' }).tap()
  await page.getByRole('menuitem', { name: 'Link to saving or debt' }).tap()
  await page.locator('main').getByRole('button', { name: /^Cash ISA/ }).last().tap()
  await expect(page.locator('main')).toContainText('→ Cash ISA')

  await page.getByRole('link', { name: /Budgets/ }).first().tap()
  await page.getByRole('link', { name: new RegExp(worth) }).tap()
  await expect(page.locator('main')).toContainText('£ 250.00 a month from')

  // Values are updated by tapping them; there's no separate catch-up page.
  await expect(page.getByRole('link', { name: 'Catch Up' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Cash ISA current value' }).tap()
  await pressKeys(page, 'plus', '2', '5', '0')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()
  await page.getByRole('button', { name: 'Mortgage amount owed' }).tap()
  await pressKeys(page, 'minus', '4', '5', '0')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()

  await expect(page.locator('main')).toContainText('£ 12,650.00')
  await expect(page.locator('main')).toContainText('▲ £ 250.00 since')
  await expect(page.locator('main')).toContainText('▼ £ 450.00 since')
  await page.getByRole('button', { name: 'Options for Mortgage' }).tap()
  await page.getByRole('menuitem', { name: 'History' }).tap()
  await expect(page.locator('main')).toContainText('£ 180,000.00')
  await expect(page.locator('main')).toContainText('£ 179,550.00')
})

test('hides the balance where there are only savings & debts budgets', async ({ page }) => {
  const folder = unique('Investments')
  await addFolder(page, folder)
  await page.getByRole('link', { name: new RegExp(folder) }).tap()
  const balance = page.locator('footer').getByText('Folder Balance:')

  // Empty, then only savings & debts: nothing to total.
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
  await expect(balance).toHaveCount(0)
  await addBudget(page, unique('Pensions'), 'Savings & debts')
  await page.getByRole('link', { name: new RegExp(folder) }).tap()
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
  await expect(balance).toHaveCount(0)

  // A regular budget brings it back.
  await addBudget(page, unique('Fund'))
  await addRow(page, 'Add Income', 'Top-up', '5', '0')
  await page.getByRole('link', { name: new RegExp(folder) }).tap()
  await expect(balance).toBeVisible()
  await expect(page.locator('footer')).toContainText('+ £ 50.00')
})

test('swipe to delete a value from history, with undo', async ({ page }) => {
  const name = unique('Net worth')
  await addBudget(page, name, 'Savings & debts')
  await addRow(page, 'Add Saving', 'Cash ISA', '1', '2', '4', '0', '0')
  await addRow(page, 'Add Saving', 'Bonds', '5', '0', '0', '0')
  for (const keys of [['plus', '2', '5', '0'], ['plus', '1', '0', '0']]) {
    await page.getByRole('button', { name: 'Cash ISA current value' }).tap()
    await pressKeys(page, ...keys)
    await keypad(page).getByRole('button', { name: 'Done' }).tap()
  }
  const isa = page.locator('main li').filter({ hasText: 'Cash ISA' })
  await expect(isa).toContainText('£ 12,750.00')

  const openHistory = async (item: string) => {
    await page.getByRole('button', { name: `Options for ${item}` }).tap()
    await page.getByRole('menuitem', { name: 'History' }).tap()
    await expect(page.locator('header h1')).toHaveText('History')
  }
  const backToBudget = () => page.locator('header a').tap()
  const history = page.locator('main')
  const historyRow = (amount: string) => history.locator('li').filter({ hasText: amount })

  // Deleting the newest value puts the current value back; Undo restores it.
  await openHistory('Cash ISA')
  await swipe(page, historyRow('£ 12,750.00'), -120)
  await history.getByRole('button', { name: /^Delete £ 12,750.00 from/ }).tap()
  await expect(undoMessage(page)).toContainText('Deleted £ 12,750.00 from')
  await expect(historyRow('£ 12,750.00')).toHaveCount(0)
  await page.getByRole('button', { name: 'Undo' }).tap()
  await expect(historyRow('£ 12,750.00')).toHaveCount(1)

  // Deleting an older value is final once the message goes.
  await swipe(page, historyRow('£ 12,650.00'), -120)
  await history.getByRole('button', { name: /^Delete £ 12,650.00 from/ }).tap()
  await expect(undoMessage(page)).toBeHidden({ timeout: 10_000 })
  await page.reload()
  await expect(history.locator('li')).toHaveCount(2)
  await expect(history).toContainText('£ 12,750.00')
  await expect(history).toContainText('£ 12,400.00')
  await expect(history).not.toContainText('£ 12,650.00')
  await backToBudget()
  await expect(isa).toContainText('£ 12,750.00')

  // An item's only value can't be deleted.
  await openHistory('Bonds')
  await swipe(page, history.locator('li').first(), -120)
  await expect(history.getByRole('button', { name: /^Delete/ })).toHaveCount(0)
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
  const background = (locator: ReturnType<Page['locator']>) =>
    locator.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await background(page.locator('header'))).toBe('rgb(47, 42, 110)')
  // Filled buttons are outlined in dark mode.
  expect(await background(page.getByRole('button', { name: 'Add Budget' }))).toBe('rgba(0, 0, 0, 0)')

  await addBudget(page, unique('Monthly'))
  await addRow(page, 'Add Expense', 'Water', '7', '3')
  expect(await background(page.locator('main li > div').first())).toBe('rgb(37, 39, 45)')
})

test('a ⋮ menu opens from its button, and a tap outside only closes it', async ({ page }) => {
  await addBudget(page, unique('Monthly'))
  await addRow(page, 'Add Expense', 'Water', '7', '3')
  const button = page.getByRole('button', { name: 'Options for Water' })
  const menu = page.getByRole('menu')

  await button.tap()
  await expect(menu).toBeVisible()
  const b = (await button.boundingBox())!
  const m = (await menu.boundingBox())!
  // Just below its button, right edges lined up (as far as the screen edge allows).
  expect(m.y).toBeGreaterThanOrEqual(b.y + b.height)
  expect(m.y).toBeLessThan(b.y + b.height + 12)
  expect(Math.abs(m.x + m.width - (b.x + b.width))).toBeLessThanOrEqual(10)

  // Tapping where the back link is closes the menu, and doesn't follow the link.
  const url = page.url()
  const back = (await page.locator('header a').boundingBox())!
  await page.touchscreen.tap(back.x + back.width / 2, back.y + back.height / 2)
  await expect(menu).toBeHidden()
  expect(page.url()).toBe(url)

  await button.tap()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(button).toBeFocused()
})

test('a menu near the bottom of the screen opens upwards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 560 })
  const folder = unique('Lots')
  await addFolder(page, folder)
  await page.getByRole('link', { name: new RegExp(folder) }).tap()
  for (let i = 1; i <= 6; i++) await addBudgetHere(page, `Budget ${i}`)

  const last = page.getByRole('button', { name: 'Options for Budget 6' })
  await last.scrollIntoViewIfNeeded()
  await last.tap()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  const b = (await last.boundingBox())!
  const m = (await menu.boundingBox())!
  expect(m.y + m.height).toBeLessThanOrEqual(b.y)
  expect(m.y).toBeGreaterThanOrEqual(0)
})

test("a folder that isn't empty shows why it can't be deleted", async ({ page }) => {
  const full = unique('Full')
  const empty = unique('Empty')
  for (const name of [full, empty]) {
    await addFolder(page, name)
  }
  await page.getByRole('link', { name: new RegExp(full) }).tap()
  await addBudgetHere(page, unique('Inside'))
  await page.getByRole('link', { name: /Budgets/ }).first().tap()

  await page.getByRole('button', { name: `Options for ${full}` }).tap()
  const deleteFull = page.getByRole('menuitem', { name: /Delete/ })
  await expect(deleteFull).toHaveAttribute('aria-disabled', 'true')
  await expect(deleteFull).toContainText('Move or delete what’s inside first')
  // Playwright won't tap a disabled item unless forced; the point is that nothing happens.
  await deleteFull.tap({ force: true })
  await expect(page.getByRole('menu')).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: `Options for ${empty}` }).tap()
  await page.getByRole('menuitem', { name: 'Delete' }).tap()
  await expect(page.getByRole('link', { name: new RegExp(empty) })).toHaveCount(0)
})

test('renames budgets and folders in place', async ({ page }) => {
  const folder = unique('Bills')
  await addFolder(page, folder)

  // On a card in the list.
  await page.getByRole('button', { name: `Options for ${folder}` }).tap()
  await page.getByRole('menuitem', { name: 'Rename' }).tap()
  const box = page.getByLabel(`Name for ${folder}`)
  await expect(box).toBeFocused()
  await box.fill(`${folder} 2`)
  await page.keyboard.press('Enter')
  await expect(page.getByRole('link', { name: `${folder} 2` })).toBeVisible()

  // Escape keeps the old name.
  await page.getByRole('button', { name: `Options for ${folder} 2` }).tap()
  await page.getByRole('menuitem', { name: 'Rename' }).tap()
  await page.getByLabel(`Name for ${folder} 2`).fill('Not this')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('link', { name: `${folder} 2` })).toBeVisible()

  // In a budget's header.
  const budget = unique('Car')
  await addBudget(page, budget)
  await page.getByRole('button', { name: 'Budget menu' }).tap()
  await page.getByRole('menuitem', { name: 'Rename' }).tap()
  await page.getByLabel(`Name for ${budget}`).fill(`${budget} costs`)
  await page.keyboard.press('Enter')
  await expect(page.locator('header h1')).toHaveText(`${budget} costs`)

  await page.reload()
  await expect(page.locator('header h1')).toHaveText(`${budget} costs`)
  await page.getByRole('link', { name: /Budgets/ }).first().tap()
  await expect(page.getByRole('link', { name: new RegExp(`${budget} costs`) })).toBeVisible()
  await expect(page.getByRole('link', { name: `${folder} 2` })).toBeVisible()
})

test('signs out from the menu', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu' }).tap()
  await expect(page.getByRole('menu')).toContainText('Signed in as')
  await page.getByRole('menuitem', { name: 'Sign out' }).tap()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
})

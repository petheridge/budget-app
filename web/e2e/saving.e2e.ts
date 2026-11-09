import { expect, test, type Page } from '@playwright/test'
import { addBudget, addRow, BASE_URL, keypad, pressKeys, setRateLimit, signIn, unique, USER } from './helpers'

// What happens when a save can't get through, or two things happen close together.

let pageErrors: string[] = []

test.beforeEach(async ({ page }) => {
  pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await signIn(page)
})

test.afterEach(() => {
  expect(pageErrors, 'errors in the page').toEqual([])
})

const problem = (page: Page) => page.getByRole('button', { name: /^Couldn’t|^Couldn't/ })
const ENTRY = '**/api/collections/entries/records/*'

test('says so when an amount or a name fails to save', async ({ page }) => {
  await addBudget(page, unique('Monthly'))
  await addRow(page, 'Add Income', 'Salary', '1', '0', '0')
  await page.route(ENTRY, (route) => (route.request().method() === 'PATCH' ? route.abort() : route.continue()))

  await page.getByRole('button', { name: 'Salary amount' }).tap()
  await pressKeys(page, '5', '5', '5')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()
  await expect(problem(page)).toHaveText("Couldn't save the amount. Please try again.")
  await expect(page.getByRole('button', { name: 'Salary amount' })).toHaveText('+ £ 100.00')
  await problem(page).tap()
  await expect(problem(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Rename Salary' }).tap()
  await page.getByLabel('Name for Salary').fill('Wages')
  await page.keyboard.press('Enter')
  await expect(problem(page)).toHaveText("Couldn't save the name. Please try again.")
  await expect(page.getByRole('button', { name: 'Rename Salary' })).toBeVisible()
})

test('a value changed while a delete can still be undone is kept', async ({ page }) => {
  await addBudget(page, unique('Net worth'), 'Savings & debts')
  await addRow(page, 'Add Saving', 'ISA', '1', '0', '0')
  const value = page.getByRole('button', { name: 'ISA current value' })
  const setValue = async (...keys: string[]) => {
    await value.tap()
    await pressKeys(page, ...keys)
    await keypad(page).getByRole('button', { name: 'Done' }).tap()
  }
  await setValue('2', '0', '0')
  await expect(value).toContainText('£ 200.00')

  // Deleting the newest value puts the ISA back to £100, six seconds from now…
  await page.getByRole('button', { name: 'Options for ISA' }).tap()
  await page.getByRole('menuitem', { name: 'History' }).tap()
  await page.getByRole('button', { name: /^Delete £ 200.00 from/ }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible()
  await page.locator('header a').tap()
  await expect(value).toContainText('£ 100.00')

  // …and a new value set before then must not be overwritten by that.
  await setValue('3', '0', '0')
  await expect(value).toContainText('£ 300.00')
  await page.waitForTimeout(7000)
  await page.reload()
  await expect(value).toContainText('£ 300.00')
  await expect(value).toContainText('▲ £ 200.00 since')

  await page.getByRole('button', { name: 'Options for ISA' }).tap()
  await page.getByRole('menuitem', { name: 'History' }).tap()
  const history = page.locator('main li')
  await expect(history).toHaveCount(2)
  await expect(history.nth(0)).toContainText('£ 300.00')
  await expect(history.nth(1)).toContainText('£ 100.00')
})

test('clearing an amount and tapping away leaves it as it was', async ({ page }) => {
  await addBudget(page, unique('Monthly'))
  await addRow(page, 'Add Income', 'Salary', '1', '0', '0')
  const amount = page.getByRole('button', { name: 'Salary amount' })

  await amount.tap()
  await pressKeys(page, 'delete', 'delete', 'delete', 'delete', 'delete', 'delete')
  await page.getByText('Balance', { exact: true }).tap()
  await expect(keypad(page)).toBeHidden()
  await expect(amount).toHaveText('+ £ 100.00')

  // Done on an empty keypad too. Zero is still there to be typed.
  await amount.tap()
  await pressKeys(page, 'delete', 'delete', 'delete', 'delete', 'delete', 'delete')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()
  await expect(amount).toHaveText('+ £ 100.00')
  await amount.tap()
  await pressKeys(page, '0')
  await keypad(page).getByRole('button', { name: 'Done' }).tap()
  await expect(amount).toHaveText('£ 0.00')
})

test("a saving whose history can't be written is still added, once", async ({ page }) => {
  await addBudget(page, unique('Net worth'), 'Savings & debts')
  await page.route('**/api/collections/snapshots/records', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  )
  await addRow(page, 'Add Saving', 'Bonds', '5', '0', '0')
  await expect(problem(page)).toHaveText("Couldn't add the value to its history.")
  // The row has closed rather than offering to save again, which would add it twice.
  await expect(page.getByLabel('Saving name')).toHaveCount(0)
  await page.unroute('**/api/collections/snapshots/records')
  await page.reload()
  await expect(page.locator('main li').filter({ hasText: 'Bonds' })).toHaveCount(1)
})

test('says when the app is not connected', async ({ page, context }) => {
  const notice = page.getByText('Not connected. Changes won’t be saved.')
  await expect(notice).toHaveCount(0)
  await context.setOffline(true)
  await expect(notice).toBeVisible()
  await context.setOffline(false)
  await expect(notice).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
})

test('limits how fast passwords can be tried', async ({ request }) => {
  await setRateLimit(true)
  try {
    const statuses: number[] = []
    for (let i = 0; i < 12; i++) {
      const response = await request.post(`${BASE_URL}/api/collections/users/auth-with-password`, {
        data: { identity: USER.email, password: 'not-the-password' },
      })
      statuses.push(response.status())
    }
    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(400))
    expect(statuses.slice(10)).toEqual([429, 429])
    // Only sign-in is limited: the app's own requests are not.
    expect((await request.get(`${BASE_URL}/api/health`)).status()).toBe(200)
  } finally {
    await setRateLimit(false)
  }
})

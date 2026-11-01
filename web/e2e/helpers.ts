import { expect, type Locator, type Page } from '@playwright/test'

export const BASE_URL = 'http://127.0.0.1:8091'
export const USER = { email: 'e2e@example.com', password: 'e2e-user-password' }

/** A name no other test uses, so tests can share the database. */
export const unique = (name: string) => `${name} ${Math.random().toString(36).slice(2, 7)}`

export async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(USER.email)
  await page.getByLabel('Password').fill(USER.password)
  await page.getByRole('button', { name: 'Sign in' }).tap()
  await expect(page.getByRole('button', { name: 'Add Budget' })).toBeVisible()
}

/** Adds a budget from the list screen and opens it. */
export async function addBudget(page: Page, name: string, kind: 'Budget' | 'Savings & debts' = 'Budget') {
  await page.getByRole('button', { name: 'Add Budget' }).tap()
  if (kind !== 'Budget') await page.getByRole('radio', { name: new RegExp(kind) }).tap()
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Save' }).tap()
  await page.getByRole('link', { name: new RegExp(name) }).tap()
}

export const keypad = (page: Page) => page.getByRole('group', { name: 'Amount keypad' })

/** Taps keys on the app's amount keypad: digits, '.', 'plus', 'minus', 'times', 'divide', 'delete'. */
export async function pressKeys(page: Page, ...keys: string[]) {
  for (const key of keys) await keypad(page).getByRole('button', { name: key, exact: true }).tap()
}

/** Adds a row inline with the Add … button: name on the keyboard, amount on the keypad. */
export async function addRow(page: Page, button: string, name: string, ...amountKeys: string[]) {
  await page.getByRole('button', { name: button }).tap()
  await page.keyboard.type(name)
  await page.keyboard.press('Enter')
  await pressKeys(page, ...amountKeys)
  await keypad(page).getByRole('button', { name: 'Save' }).tap()
  await expect(keypad(page)).toBeHidden()
  // The row appears once the server has saved it, a moment after the keypad closes.
  await expect(page.locator('main li').filter({ hasText: name })).toBeVisible()
}

/** The first line of each row or card in the screen's list, top to bottom. */
export async function rowNames(page: Page) {
  return (await page.locator('main li').allInnerTexts()).map((text) => text.split('\n')[0])
}

/** Press and hold a row with a real touch, then drag it onto another, as on an iPhone. */
export async function holdAndDrag(page: Page, from: Locator, to: Locator) {
  const cdp = await page.context().newCDPSession(page)
  const touch = (type: string, x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] })
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  const x = a.x + 40
  const y0 = a.y + a.height / 2
  const y1 = b.y + b.height / 2 + (b.y > a.y ? 8 : -8)
  await touch('touchStart', x, y0)
  await page.waitForTimeout(500)
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', x, y0 + ((y1 - y0) * i) / 12)
    await page.waitForTimeout(16)
  }
  await page.waitForTimeout(150)
  await touch('touchEnd', x, y1)
  await page.waitForTimeout(300)
}

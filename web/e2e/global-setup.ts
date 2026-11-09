import { adminApi, setRateLimit, USER } from './helpers'

/** Creates the user the tests sign in as, in the fresh database. */
export default async function globalSetup() {
  const api = await adminApi()

  // The migrations turn the sign-in limit on. Every test signs in, dozens of times a
  // minute from one address, so it's off here; its own test turns it on for a moment.
  const settings = (await (await api('/api/settings')).json()) as { rateLimits: { enabled: boolean } }
  if (!settings.rateLimits.enabled) throw new Error('The sign-in rate limit should be on after the migrations')
  await setRateLimit(false)

  const user = await api('/api/collections/users/records', 'POST', {
    email: USER.email,
    password: USER.password,
    passwordConfirm: USER.password,
  })
  if (!user.ok) throw new Error(`Couldn't create the test user: ${user.status} ${await user.text()}`)
}

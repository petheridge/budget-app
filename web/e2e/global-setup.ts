import { BASE_URL, USER } from './helpers'

/** Creates the user the tests sign in as, in the fresh database. */
export default async function globalSetup() {
  const auth = await fetch(`${BASE_URL}/api/collections/_superusers/auth-with-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identity: 'e2e-admin@example.com', password: 'e2e-admin-password' }),
  })
  if (!auth.ok) throw new Error(`Couldn't sign in as the test admin: ${auth.status}`)
  const { token } = (await auth.json()) as { token: string }
  const user = await fetch(`${BASE_URL}/api/collections/users/records`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: token },
    body: JSON.stringify({ email: USER.email, password: USER.password, passwordConfirm: USER.password }),
  })
  if (!user.ok) throw new Error(`Couldn't create the test user: ${user.status} ${await user.text()}`)
}

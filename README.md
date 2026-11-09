# Tally

A simple household budget planner, modelled on the Fudget iOS app. It runs on a home server and is used from an iPhone as an installable web app.

- **Budgets** hold income and expenses and show a balance. Folders organise them.
- **Savings & debts** budgets hold current values (an ISA, a mortgage) with a dated history.
- Everything is edited in place: no pop-ups, and deletes can be undone.

The backend is [PocketBase](https://pocketbase.io) (one binary, SQLite). The frontend is React, Vite, TypeScript and Tailwind. `CLAUDE.md` is the full brief: data model, screens, behaviour and conventions.

## Run it locally

You need Node 22 and `curl`.

```sh
./pocketbase/install.sh          # downloads the PocketBase binary (checksum verified)
cd web && npm install && cd ..
```

Then, in two terminals:

```sh
cd pocketbase && ./pocketbase serve      # API and admin UI on http://127.0.0.1:8090
cd web && npm run dev                    # the app on http://localhost:5173
```

The first time, create an admin account and then a user to sign in as:

```sh
cd pocketbase && ./pocketbase superuser create you@example.com 'a-long-password'
```

Open the admin UI at `http://localhost:5173/_/` and add a record to the `users` collection. Public sign-up is turned off.

## Checks

Run these in `web/`:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (money, keypad, selectors, CSV) |
| `npm run typecheck` | TypeScript, strict |
| `npm run build` | Type-check, then build to `web/dist` |
| `npm run e2e` | Builds, then runs the end-to-end tests against a throwaway PocketBase in an iPhone-sized Chromium |

`npm run e2e` needs the PocketBase binary from `install.sh`, and Chromium (`npx playwright install chromium`).

## Deploy

Pushing to `main` tests, builds and publishes a Docker image; the server pulls it. Setting up the server, backups, rolling back and restoring are in [`deploy/README.md`](deploy/README.md).

The schema lives in `pocketbase/pb_migrations/` and is applied when the server starts. Change it there, never only in the admin UI.

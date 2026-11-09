# Code review — Tally (budget-app)

Reviewed at commit `770d676` on 9 November 2026. Scope: the whole repository (web app, PocketBase migrations, Docker, CI, deploy scripts).

## Summary

The codebase is in good shape for its size: small, readable, strict TypeScript, and close to the brief.
Money handling is sound. Amounts are integer pence end to end, the keypad sums use exact integer arithmetic, and the server rejects fractional and negative amounts.
The weak spot is the write path in `web/src/lib/data.tsx`: some saves fail without telling anyone, and the Undo window can overwrite a newer value.
Deployment is careful (pull-based, checksummed binary, consistent backups, documented restore), with one gap: new versions migrate live data without a backup first.
All existing checks pass (60 unit tests, 17 end-to-end tests, type-check and build); there is no linter or formatter.

**Top 3 priorities**

1. **F1** — show a message when changing an amount or name fails to save. Today it fails silently.
2. **F2** — stop a pending Undo from overwriting a saving's or debt's newer value.
3. **F4** — back up `pb_data` before an automatic update applies migrations.

## Findings

Ordered by severity, then effort. "Reproduced" means I ran it against a throwaway PocketBase with the real migrations and the built app; the rest are confirmed by reading the cited lines.

| ID | Severity | Area | File:line | Issue | Recommended fix | Effort |
|---|---|---|---|---|---|---|
| F1 | High | Error handling | `web/src/components/InlineAmount.tsx:39,54,73`<br>`web/src/components/InlineName.tsx:18,26`<br>`web/src/components/BudgetMenu.tsx:92` | Changing an amount or a name calls `updateEntry` with no error handling. If the request fails (phone offline, server restarting for the nightly backup), the keypad closes, the old value comes back and nothing is shown. **Reproduced:** with the update request blocked, the amount stayed at £100.00, no "Couldn't…" message appeared, and the browser logged an unhandled `ClientResponseError`. Notes and renaming budgets already do this properly through `report(...)` (`InlineNote.tsx:35`). `setBudgetKind` has the same gap. | Wrap the three calls in `report('save the amount', …)`, as `InlineNote` does. | S |
| F2 | High | Correctness | `web/src/lib/data.tsx:155-167,183-199,302-309` | Deleting the newest history value schedules a write that sets the item back to the previous value 6 seconds later (`data.tsx:166`). If the value is changed again inside those 6 seconds, that delayed write overwrites it. **Reproduced:** ISA at £100 → £200, delete the £200 value, then set £300 before Undo expires. Afterwards the server holds a current value of £100.00 with a history of £300, £100. The screen shows £300 until the next reload, then £100. | Call `commitDelete()` at the start of `createEntry`, `updateEntry` and `setEntryLink`, so a pending delete is made final before any other write (as `deleteFolder` already does at `data.tsx:260`). Add an end-to-end test for this sequence. | S |
| F3 | Med | Correctness | `web/src/components/InlineAmount.tsx:36,51-54` | Clearing an amount with ⌫ and tapping elsewhere (or Done) saves £0.00, because an empty keypad is treated as zero. For a saving or debt this also writes a £0.00 value into its history. **Reproduced** on a budget entry. The brief only says an empty amount is £0.00 for a *new* row. | Treat an empty keypad on an existing amount as "no change" (`if (pence === null) return` after `onClose()`). See open question 1. | S |
| F4 | Med | Data safety | `deploy/update.sh:16`<br>`deploy/README.md:111` | Every 5 minutes the host pulls `latest` and restarts, and migrations run on start. A faulty migration therefore reaches the live database within minutes of a merge, and the newest backup can be up to 24 hours old. Separately, a failed backup is only written to `logs/backup.log`, which the README says to "look at now and then". | In `update.sh`, when the pulled image differs from the running one, run `backup.sh` (or a local `tar` of `pb_data`) before `docker compose up -d`. For failed backups, have `backup.sh` touch a `last-success` file and let `update.sh` log loudly when it is over 48 hours old; anything beyond that is optional. | M |
| F5 | Med | Data safety | `web/src/lib/data.tsx:151-153,292-309,161-166`<br>`web/src/components/DraftEntryRow.tsx:52-59` | A saving's or debt's value and its history entry are two separate requests made by the phone. If the second fails, the history no longer matches the current value (the brief's rule that "the latest snapshot matches the entry's `amount_pence`" is kept only by the client). When adding a new saving, a failed history write also shows "Couldn't save. Press Save to try again", and trying again adds the item a second time, because the first request succeeded. | Simplest: in `createEntry`/`updateEntry`, treat the entry write as the save; if the snapshot write fails, report it through `guard` and don't re-throw. More robust, and still small: write the snapshot in a PocketBase hook (`pb_hooks`, `onRecordAfterCreateSuccess`/`UpdateSuccess` on `entries`), so it is done on the server in one place. | M |
| F6 | Med | Testing | `web/src/lib/data.tsx` (whole file)<br>`web/e2e/app.e2e.ts` | The pure code (`money.ts`, `keypad.ts`, `selectors.ts`) is well tested, but the store that does every write, delete and undo has no unit tests, and no end-to-end test covers a failed save or two phones at once. F1, F2 and F3 all sit in that gap. | Add three end-to-end tests using Playwright's `page.route` to fail a request: a failed amount change shows a message; the F2 sequence leaves value and history in step; a failed add doesn't duplicate. No new dependencies needed. | M |
| F7 | Low | Robustness | `web/src/lib/data.tsx:302-304`<br>`InlineName.tsx:18`, `InlineNote.tsx:34-35`, `InlineAmount.tsx:39` | Every edit sends all four fields (name, amount, type, note) taken from what the screen currently shows, not just the one that changed. Two phones editing different fields of the same entry can undo each other, and during an Undo window the amount sent is the temporary local one (part of F2). | Let `updateEntry` take only the changed fields (`Partial<EntryFields>`), and have each caller pass one field. | S |
| F8 | Low | Ops | `Dockerfile:10-28`<br>`deploy/docker-compose.yml:3-11` | The container runs as root, has no health check and no limit on Docker's log size. | Add a `healthcheck` using `wget -qO- http://127.0.0.1:8090/api/health` (BusyBox `wget` is already in the image) and `logging` options (`max-size: 10m`, `max-file: 3`) to the compose file. Running as a non-root user is optional here: it needs the `pb_data` folder's ownership changing on the host. | S |
| F9 | Low | Security | `.github/workflows/build.yml:12-14` | `packages: write` is granted to the whole workflow, so the test jobs on pull requests have it too. Only `publish` needs it. | Move `packages: write` to the `publish` job; leave `contents: read` at the top. | S |
| F10 | Low | Security | `pocketbase/pb_migrations/1761926400_initial_schema.js:79-82` | Public sign-up is correctly turned off and anonymous requests return nothing (both checked). PocketBase's rate limiting is off by default, so sign-in attempts aren't limited. Acceptable on a home LAN; worth turning on before any remote access. | Add a migration that sets `settings.rateLimits.enabled = true` with a rule for `*:auth`. | S |
| F11 | Low | Housekeeping | `web/tsconfig.tsbuildinfo`<br>`web/src/lib/money.ts:78-84`<br>`CLAUDE.md:69`<br>`pocketbase/pb_migrations/1793577600_entry_links.js:3-4` | Leftovers: a compiler cache file is committed (and `tsconfig.json` doesn't use incremental builds); `parsePence` is used only by its own tests; `CLAUDE.md:69` still describes a budget screen footer that line 109 says was removed; a migration comment refers to the removed Catch Up feature. | Delete `tsconfig.tsbuildinfo` and add `*.tsbuildinfo` to `.gitignore`; delete `parsePence` and its tests; correct the two comments. | S |
| F12 | Low | Developer experience | repo root, `web/package.json:6-12` | There is no README at the root (setup lives in `CLAUDE.md` and `deploy/README.md`), and no linter or formatter, so style relies on habit. The type-check only runs as part of `npm run build`. | Add a 20-line `README.md` (what it is, first-time setup, the three commands, link to `deploy/README.md`). Add a `typecheck` script. A formatter (Prettier) is optional and would be a new dependency. | S |
| F13 | Low | Architecture | `web/src/routes/BudgetDetail.tsx:38-49,70-105,107-181`<br>`web/src/routes/TrackerDetail.tsx:39-50,66-111,113-189` | The two detail screens are about 80% the same code: the draft and editing state, the row layout, the header and the menus. Any change to a row has to be made twice. | Extract the shared row (name, note, amount, ⋮) into one `EntryRow` component with slots for the line under the name and the amount display. Leave the two screens separate; don't merge them into one configurable screen. | M |
| F14 | Low | Accessibility | `web/src/components/ReorderList.tsx:54-57` | Reordering works by touch and mouse only; there is no keyboard way to move a row. Otherwise accessibility is good: labelled controls, proper menu roles, focus handling, reduced motion respected. | Add dnd-kit's `KeyboardSensor` (already installed with `@dnd-kit/core`), or accept this for a phone-first household app. | S |
| F15 | Low | Server validation | `pocketbase/pb_migrations/1793491200_savings_and_debts.js:15-17` | The server accepts a `saving` entry in a regular budget (**reproduced**, HTTP 200), and doesn't stop a budget's kind changing while it has entries. Only the app prevents these. Amount rules *are* enforced on the server. | Accept as is: every user is a trusted household member and the app never does this. Note it in `CLAUDE.md`. | — |
| F16 | Low | Dependencies | `web/package-lock.json` | `npm audit` reports 6 issues (4 moderate, 2 low), all in build-time packages pulled in by `vite-plugin-pwa` (`workbox-build`, `glob`, `minimatch`, `deepmerge`). None ships to the browser or the server. | No action now. Don't run `npm audit fix --force`: it downgrades `vite-plugin-pwa` to 1.1.0. Update when a fixed release is out. | — |

### Checked and found sound

- **Money:** no floats anywhere in amounts. `evaluateAmount` works in integer numerators and denominators, rounds each part half-up, and refuses results that are negative or too large (`money.ts:122-165`). The server rejected `10.5`, `-5` and `1e20` pence.
- **Totals:** computed, never stored; empty budgets total £0.00; root and folder balances exclude savings & debts as the brief requires (`selectors.ts:43-49`), with unit tests.
- **Security:** no secrets in the repository; no `dangerouslySetInnerHTML` or HTML injection routes (React escapes all names and notes); all four collections need a signed-in user; sign-up returns 403.
- **Deploy:** PocketBase download is checksum-verified in both `install.sh` and the `Dockerfile`; backups stop the app for a consistent copy, refuse to write to the root disk, and only rename a finished archive.

## Test results

Run on Node 22.23.4 after `npm ci` (lockfile only, nothing added).

| Command | Result |
|---|---|
| `npm test` (Vitest) | **Passed** — 60 tests in 4 files |
| `npm run build` (`tsc --noEmit` + Vite) | **Passed** — 395 kB JS (123 kB gzipped), service worker generated |
| `npx playwright test` (after `./pocketbase/install.sh`, PocketBase 0.40.6) | **Passed** — 17 of 17 in 55 s |
| `npm audit` | 6 issues: 4 moderate, 2 low, all build-time (F16) |
| Lint / format | None configured (F12) |
| Docker image build | Not run: no Docker in the review environment |

I also ran a one-off script (not added to the repo) to reproduce F1, F2, F3 and F15 and to check the server's access rules and settings.

## Suggested backlog

Each item is one small commit.

- [ ] **1. Report failed amount and name saves (F1).** Done when an end-to-end test that blocks `PATCH /api/collections/entries/records/*` sees "Couldn't save the amount" after pressing Done, and the same for a rename.
- [ ] **2. Make a pending delete final before other writes (F2).** Done when an end-to-end test runs: set £100, set £200, delete the £200 history value, set £300 within the Undo window, wait 7 seconds, reload; and the row shows £300.00 with history £300, £100.
- [ ] **3. Empty keypad on an existing amount means no change (F3).** Done when a test clears a £100 amount, taps elsewhere, and the row still shows £100.00. (Skip if open question 1 is answered "zero is intended".)
- [ ] **4. Send only the changed field (F7).** Done when `updateEntry` accepts `Partial<EntryFields>`, each caller passes one field, and the existing end-to-end tests still pass.
- [ ] **5. Don't fail an add when only the history write fails (F5, simple option).** Done when a test that blocks `POST …/snapshots/records` adds a saving, sees it once in the list along with a "Couldn't…" message, and no second item appears.
- [ ] **6. Back up before an update that changes the image (F4).** Done when running `update.sh` with a new image available leaves a new archive in `BACKUP_DEST` dated before the restart, and a run with no new image doesn't.
- [ ] **7. Make failed backups visible (F4).** Done when `backup.sh` writes `logs/last-backup-success` and `update.sh` logs a clear warning when that file is more than 48 hours old.
- [ ] **8. Health check and log limits (F8).** Done when `docker compose ps` on the host shows the container as `healthy`.
- [ ] **9. Narrow CI permissions (F9).** Done when `packages: write` appears only under the `publish` job and a pull-request run still passes.
- [ ] **10. Tidy leftovers (F11).** Done when `web/tsconfig.tsbuildinfo` and `parsePence` are gone, `*.tsbuildinfo` is ignored, the two stale comments are fixed, and `npm test` and `npm run build` pass.
- [ ] **11. Root README and `typecheck` script (F12).** Done when a new clone can be brought up by following `README.md` alone.
- [ ] **12. Share the entry row between the two detail screens (F13).** Done when both screens render rows through one `EntryRow` component and the end-to-end suite passes unchanged.
- [ ] **13. Turn on sign-in rate limiting (F10).** Do this before setting up remote access. Done when a new migration enables it and a burst of wrong passwords gets HTTP 429.
- [ ] **14. Keyboard reordering (F14).** Optional. Done when a row can be moved with Space and the arrow keys.

## Open questions

1. **Clearing an amount (F3):** should emptying an existing amount save £0.00, or leave it unchanged? The brief is explicit only for new rows.
2. **History on the server (F5):** are you open to a small `pb_hooks` file so the server records history values itself? It is more reliable than the client doing it, but adds a second place where logic lives, and the `Dockerfile` would need to copy it.
3. **Updates and migrations (F4):** is fully automatic deployment of schema changes intended, or would you rather migrations wait for a manual step? A backup-before-update is the lighter option.
4. **Backups:** the NAS is the only copy. Is a second copy elsewhere (another disk or off-site) wanted, or is the NAS itself backed up?
5. **Server-side rules (F15):** is it fine for entry type and budget kind to be enforced by the app only?
6. **Keyboard reordering (F14):** does anyone use the app from a computer enough for this to matter?

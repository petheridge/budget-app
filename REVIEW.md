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

## Suggested features

Features worth adding that an agent could build and test on its own. Each is small, uses the app's existing patterns (menus, editing in place, full screens, Undo), needs no new dependency, and can be proven with the end-to-end suite in headless Chromium. None was built or prototyped for this review; the "what it touches" notes come from reading the code.

Do backlog items 1, 2 and 4 first: every feature below writes through `data.tsx`, and should be built on a write path that reports failures.

Per the project conventions, each feature also needs an end-to-end test and an update to `CLAUDE.md` (the screens section, and the out-of-scope list where it names the feature).

| ID | Feature | Why it's worth it | Effort | Schema change |
|---|---|---|---|---|
| N1 | Duplicate a budget | Saves retyping every entry each month | S | No |
| N2 | "Not connected" notice | Tells you *before* you type that a change won't save | S | No |
| N3 | Export as CSV | A copy of your data you can read without the app | S–M | No |
| N4 | Move an entry to another budget | Fixes an entry added in the wrong place without delete and retype | S | No |
| N5 | Move a folder into another folder | The data model allows subfolders, but a folder can't be moved once made | S | No |
| N6 | Paid status | Fudget's tick-off-as-you-pay; the biggest missing piece of the original | M | Yes |

### N1. Duplicate a budget

- **What:** a **Duplicate** choice in a budget's ⋮ menu. It adds "*Name* copy" at the end of the same folder with every entry copied (name, amount, type, note, order, link), and opens its name for renaming in place.
- **Scope limit:** regular budgets only. A copied savings & debts budget would need its history copied or invented, and neither is right.
- **Touches:** a `duplicateBudget` action in `web/src/lib/data.tsx` (next to `createBudget`, line 265), one item in `web/src/components/BudgetMenu.tsx:76-108`.
- **Watch for:** the copy is one request per entry. If one fails part-way, report it and leave what was copied rather than trying to roll back; Delete with Undo already cleans up.
- **Done when:** a test duplicates a budget with two incomes, an expense with a note and a linked expense, and the copy shows the same rows, order, balance and "→" link; the original is unchanged.

### N2. "Not connected" notice

- **What:** a thin bar under the header, "Not connected. Changes won't be saved.", while the app has no connection to the server; it clears on reconnect. The existing refetch on reconnect (`data.tsx:144`) stays as it is.
- **Scope limit:** a notice only. No queue of offline changes: that is a large feature with conflict handling, and not justified for a home LAN.
- **Touches:** connection state in `data.tsx` (the PocketBase client reports realtime disconnects, and the browser's `online`/`offline` events cover the rest), rendered in `web/src/components/RequireAuth.tsx` beside the existing messages.
- **Done when:** a test uses Playwright's `context.setOffline(true)`, sees the bar, goes back online and sees it go.

### N3. Export as CSV

- **What:** **Export as CSV** in a budget's menu (that budget's entries) and in the root menu (everything). Columns: folder path, budget, kind, type, name, amount, note; for savings and debts, one row per recorded value with its date.
- **Touches:** a pure `toCsv` function in a new `web/src/lib/csv.ts` with unit tests; menu items in `BudgetMenu.tsx` and `web/src/routes/BudgetList.tsx:166-176`.
- **Watch for:**
  - Amounts must be written from integer pence as text (`1234.56`), reusing `penceToInput` (`money.ts:87`), never by dividing.
  - Quote fields containing commas, quotes or line breaks. Prefix a name or note that starts with `=`, `+`, `-` or `@` with a `'` so a spreadsheet doesn't run it as a formula.
  - **Not checkable by an agent:** saving a file from an iPhone home-screen app. A plain download link works in Chromium but is unreliable there; the share sheet (`navigator.share` with a file) is the usual answer. An agent can build both paths, but only you can confirm it on the phone.
- **Done when:** unit tests cover quoting, the formula prefix, £0.00 and large amounts; an end-to-end test triggers the export and checks the downloaded file's rows.

### N4. Move an entry to another budget

- **What:** **Move to budget** in an entry's ⋮ menu, opening a submenu of budgets of the same kind (a saving can't move into a regular budget), with a ✓ on the current one, as **Move to folder** already works for budgets.
- **Touches:** a `moveEntry` action in `data.tsx` that sets `budget` and puts the entry at the end of its section; a submenu step in `web/src/components/EntryMenu.tsx`, copying the pattern at `BudgetMenu.tsx:28-52`.
- **Scope limit:** move only. Copying an entry is a different feature with less value once N1 exists.
- **Done when:** a test moves an expense between two budgets and both balances change by its amount; a saving's history and any link pointing at it survive the move.

### N5. Move a folder into another folder

- **What:** **Move to folder** in a folder's ⋮ menu, reusing the budget's submenu.
- **Touches:** a `moveFolder` action in `data.tsx`; `web/src/components/FolderMenu.tsx:27-46`.
- **Watch for:** a folder must not be offered itself or anything inside it as a destination, or it would vanish from every screen. `folderPath` (`selectors.ts:75-85`) already guards against loops when *reading*; this needs the same care when *writing*, with a unit test.
- **Done when:** a test moves a folder into another and back to the top level, and the menu for a folder with a subfolder lists neither itself nor that subfolder.

### N6. Paid status

- **What:** mark a budget entry as paid, and show how much is still to pay.
- **Why it's last:** it is the only one needing a migration (a `paid` yes/no field on `entries`) and real design decisions, and the brief lists it as out of scope for Phase 1. An agent can build it independently only once open question 7 is answered.
- **Touches:** a new migration; a tick on each row in `web/src/routes/BudgetDetail.tsx:70-105`; a "paid" total in `money.ts` with unit tests; the hero line in `web/src/components/Sections.tsx`.
- **Done when:** ticking an expense updates a "left to pay" figure, the state survives a reload and appears on a second signed-in browser, and Balance itself is unchanged.

### Considered and not recommended

- **Charts of savings history, search, sorting by name, repeating entries, carry-over balances:** each adds a lasting mode or a new screen for little gain at household scale. Sort by amount and press-and-hold already cover ordering.
- **Offline editing with sync:** see N2.
- **Importing Fudget data:** the export format isn't in the repository, so an agent would be guessing.
- **Passcode or Face ID lock:** can't be done properly in a web app, and can't be tested off the phone.

## Open questions

1. **Clearing an amount (F3):** should emptying an existing amount save £0.00, or leave it unchanged? The brief is explicit only for new rows.
2. **History on the server (F5):** are you open to a small `pb_hooks` file so the server records history values itself? It is more reliable than the client doing it, but adds a second place where logic lives, and the `Dockerfile` would need to copy it.
3. **Updates and migrations (F4):** is fully automatic deployment of schema changes intended, or would you rather migrations wait for a manual step? A backup-before-update is the lighter option.
4. **Backups:** the NAS is the only copy. Is a second copy elsewhere (another disk or off-site) wanted, or is the NAS itself backed up?
5. **Server-side rules (F15):** is it fine for entry type and budget kind to be enforced by the app only?
6. **Keyboard reordering (F14):** does anyone use the app from a computer enough for this to matter?
7. **Paid status (N6):** if you want it, three things need deciding first. Does it apply to income as well as expenses? Where does the tick go on a row that already has a tappable name, amount and ⋮? And is the extra figure "left to pay", "paid so far", or both?
8. **Which features, if any?** N1 to N5 are independent of each other and can be taken in any order or not at all. My recommendation is N1 and N2 first: N1 is the one you'd use every month, and N2 completes the fix for silent failed saves.

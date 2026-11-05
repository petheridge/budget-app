# Budget App — Project Brief

A self-hosted, simplified clone of the **Fudget** iOS budget planner. Runs on a home Proxmox server and is used from iPhone as an installable web app (PWA).

**Phase 1 goal:** separate budgets containing income (+) and expense (−) entries, with a clear total. Nothing more. Keep it simple; resist adding features not listed here.

**Added since:** *savings & debts* budgets, which hold things like an ISA or a mortgage as current values recorded over time (see screen 4). They're the one place the app deals with dates.

Use our own app name, icon and styling. Copy Fudget's *behaviour and layout*, not its branding or assets.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | **PocketBase** (single binary, SQLite) | Auth, REST API, realtime subscriptions, admin UI at `/_/` |
| Frontend | **React + Vite + TypeScript** | |
| Styling | **Tailwind CSS** | Colours as theme tokens (see below) |
| Data access | `pocketbase` JS SDK | Use realtime subscriptions so two phones stay in sync |
| Reordering | `@dnd-kit` | Press and hold a row or card, then drag |
| PWA | `vite-plugin-pwa` | Manifest + icons so it installs to the iPhone home screen |
| Deploy | Docker Compose, single container | PocketBase serves the built frontend from `pb_public/` |

Mobile-first. Design for iPhone width (~390px); it should still look fine on desktop (centred column, max-width ~600px).

---

## Data model (PocketBase collections)

Store all money as **integer pence**. Never use floats for amounts. Totals are **always computed, never stored**.

### `folders` (optional organisation)
- `name` — text, required
- `parent` — relation → `folders`, optional (null = root level; allows subfolders later)
- `sort_order` — number

### `budgets`
- `name` — text, required
- `folder` — relation → `folders`, optional (null = root level)
- `kind` — select: `budget` | `tracker` (savings & debts). Empty means `budget`. Can only be changed while the budget has no entries
- `sort_order` — number

### `entries`
- `budget` — relation → `budgets`, required, cascade delete
- `name` — text, required
- `amount_pence` — number (integer, always **positive**)
- `type` — select: `income` | `expense` (in budgets) or `saving` | `debt` (in savings & debts budgets). For savings and debts, `amount_pence` is the current value
- `note` — text, optional
- `link` — relation → `entries`, optional. On a budget **expense** only: the saving or debt it pays into. Cleared by PocketBase when that item (or its budget) is deleted
- `sort_order` — number

### `snapshots` (history of savings and debts)
- `entry` — relation → `entries`, required, cascade delete
- `amount_pence` — number (integer, positive): the value at the time
- `created` — the date it was recorded
- Written whenever a saving's or debt's value is set: when it's added, and whenever its amount changes (tapping the value). The latest snapshot matches the entry's `amount_pence`
- Can be deleted on the History screen (swipe left). Deleting the newest also sets the entry's `amount_pence` back to the one before it, saved directly so no new snapshot is written. An entry's only snapshot can't be deleted

### Access rules
Household app: any authenticated user can read/write all records. No public access. Create users via the PocketBase admin UI.

---

## Calculations

- **Entry signed value** = `+amount` for income, `−amount` for expense
- **Budget balance** = sum of its entries' signed values
- **Budget screen footer**: Income total, Expenses total, Balance
- **Folder Balance** (shown inside a folder) = sum of balances of budgets *directly* in that folder
- **All Budgets Balance** (root screen) = sum of balances of budgets at *root level only*. Budgets inside folders are **not** included. This matches observed Fudget behaviour.
- **Net worth** (savings & debts budget) = its savings minus its debts. It shows on that budget's card (in brand colour) but is **never** included in Folder Balance or All Budgets Balance, which are about monthly money in and out
- **Change since last** for a saving or debt = its current value minus the snapshot before the latest one. A saving going up or a debt going down is shown green (good); the opposite red-orange

---

## Screens

### 1. Budget list (root, and inside a folder — same screen)

**Header (brand colour):**
- Root: title "Budgets", add-folder icon, menu icon
- Inside a folder: back button labelled with the parent ("‹ Budgets"), folder icon + folder name as title, add-folder icon

**List:** white rounded cards with a soft shadow, gap between cards, on a light warm-grey background.
- **Budget card:** name (left, dark grey, regular weight) · balance (right, coloured, bold) · brand-coloured chevron · vertical divider · brand-coloured ⋮ menu
- **Folder card:** lavender folder icon · name · brand-coloured chevron · ⋮ menu. No balance shown on the card.
- Folders and budgets share one ordered list.
- Tap a card to open it.

**Bottom (pinned):**
- Full-width blue **Add Budget** button
- Footer row: "All Budgets Balance:" (root) or "Folder Balance:" (in a folder), with a large coloured total on the right. Only shown when that level has at least one regular budget: savings & debts aren't counted, so otherwise there's nothing to total

### 2. Budget detail

**Header (brand colour):** back button labelled with the parent ("‹ 📁 Monthly" or "‹ Budgets") · budget name as title · menu icon.

**Hero** (top of the list, scrolls with it): "Balance" label in grey and a large coloured balance. Only when the budget has both income and expenses, a quiet line under it: `Income £ x · Expenses £ y` (each figure in its type colour). Once it has scrolled out of sight, the balance shows in small white text under the budget's name in the header bar, as iOS large titles shrink into the bar.

**Sections** (`components/Sections.tsx`): **Income** then **Expenses**, each a rounded white section on the grey background, as in iOS Settings, with a small grey uppercase heading and its subtotal (type colour) on the right.
- Rows inside are compact (about 54px), separated by thin grey lines.
- Entry name (left) **and** amount (right) are both coloured by type: green for income, red-orange for expense. Medium/semibold weight.
- If a note exists, show it as a second line under the name: small grey text with a pencil icon.
- Vertical divider, then a brand-coloured ⋮ menu column on the right.
- Each section ends with a tinted **⊕ Add income** / **⊕ Add expense** row (as in iOS Reminders), not a filled button.
- A section only shows once it has entries (or one is being added). Budgets are often used for just one kind, such as a folder with an income budget and several outgoings budgets, whose Folder Balance is the bottom line, so an empty section would only be clutter. The kind with no section gets a small centred **⊕ Add income** / **⊕ Add expense** link under the list instead (`AddLinks`); a new, empty budget shows both.

No footer: the hero replaces the old Income / Expenses / Balance summary, and the add rows replace the big Add Income / Add Expense buttons.

### 3. Adding and editing entries
- **⊕ Add income** / **⊕ Add expense** adds a blank row inline at the end of its section (no pop-up, so the screen doesn't jump when the keyboard opens), with `type` set by the button pressed. Name is focused; Return opens the amount keypad, whose Save saves the row. Tapping outside the row and keypad also saves it; a blank name discards it; an empty amount saves as £0.00; ✕ cancels
- **Tap a name in the list** to rename it in place: it becomes a text box; Return or tapping elsewhere saves, Escape or a blank name keeps the old one. (On savings & debts rows too; their history is in ⋮)
- **Tap an amount in the list** to change it in place: the keypad opens on the current value (a digit replaces it, + or − works from it). Done saves; so does tapping elsewhere, unless the sum doesn't work out, which leaves it unchanged
- **Notes:** **Add note** / **Edit note** (from an entry's ⋮) opens the note line under the name as a text box, in place. Return or tapping elsewhere saves; Escape keeps the old note; clearing it removes the note. There's no Edit sheet: name, amount and note are all edited in place
- **Add Budget** opens a small menu (**Budget** or **Savings & debts**); the add-folder icon needs no choice. Either way a new card appears at the end of the list with its name box focused, as entries are added: Return or tapping elsewhere saves it, a blank name, Escape or ✕ discards it. It goes into the folder being shown; **Move to folder** changes that later
- **Rename** (budget or folder ⋮, or the budget screen's menu) edits the name in place: on its card in the list, or in the header on the budget's own screen. Return or tapping elsewhere saves; Escape or a blank name keeps the old one

### No pop-up windows
The app has no sheets, pop-up forms or confirmation dialogs. Four patterns cover everything:
- **Edit in place** for adding and changing things (names, amounts, notes, new budgets and folders)
- **Menus** for choices: ⋮ and header menus open from the button tapped, as iOS ⋯ menus do, dropping down from it or opening upwards when there isn't room below. A tap outside or Escape only closes them; it doesn't reach what's underneath. A choice with options swaps the menu for a submenu (Sort by amount, Move to folder, with a ✓ on the current folder) (`components/Menu.tsx`; each opening is fresh, `components/useOverlay.ts`). Nothing animates when the phone is set to reduce motion
- **Full screens** for anything needing room: a saving's or debt's **History** (`/entry/:id/history`) and a budget expense's **Link** picker (`/entry/:id/link`), each with a back button to its budget
- **Undo** instead of "Are you sure?": deletes take effect at once with a 6-second Undo

### Amount keypad
- Every amount (inline add, tapping an amount in a list) opens the app's own keypad, not the iPhone keyboard, so amounts can be sums: digits, `.`, ⌫, + − × ÷ and a full-width Done (Save on an inline row)
- A line above the keys shows the sum and its result ("576 ÷ 12   = £ 48.00"), or what's wrong ("Can't be less than £ 0.00"), and Done then stays open
- With a value already there, a digit replaces it and an operator carries on from it: "+ 250" adds to the current value
- × and ÷ come before + and −. In each part of a sum the first number is money (up to 2 decimal places) and multipliers and divisors are plain numbers. Each part is rounded to the penny, all in integer pence (`evaluateAmount` in `money.ts`, unit tested). Only the result is stored, not the sum
- It's part of the page (fixed to the bottom, above everything), so nothing jumps. A computer keyboard types into it too
- Names and notes still use the iPhone keyboard

### 4. Savings & debts budget
- Chosen when adding a budget ("Budget" or "Savings & debts"), or from the ⋮ menu while a budget is empty
- Same header and row layout as a budget. Each row: name and current value in the type colour (savings green, debts red-orange), and under the value a small "▲ £ 250.00 since 1 Oct" (or "No change since…"). Tapping the value opens the keypad to change it in place (recorded in history); tapping the name renames it. **History** (from ⋮) is its own screen, listing every recorded value with its date and change, newest first. **Swipe a value left** to show a red Delete button (as in iOS lists; a mostly vertical move scrolls instead, and tapping the open row closes it). Deleting has Undo; deleting the newest value puts the current value back to the one before; the only value can't be deleted
- Same layout as a budget: a **Net worth** hero (`Savings £ x · Debts £ y` under it when it has both), then **Savings** and **Debts** sections, each ending in an add row and shown only once it has something in it. Adding works inline, as for entries
- **Linking:** a budget expense's ⋮ has **Link to saving or debt** (then **Change link**), which opens a screen listing every savings & debts item; choosing one (or **Remove Link**) goes back to the budget. The expense shows "→ Cash ISA" under its name; the saving or debt shows "£ 250.00 a month from Household" under its name. Links are labels only: they never change a value (a budget is a plan, not a record of payments)
- Values are updated by tapping them (no separate catch-up page: it was removed as not adding enough). Each change is kept in History
- Debts are entered as positive amounts owed

### ⋮ menus
- **Entry:** Add note / Edit note, Delete (no confirm: a "Deleted “Water” · Undo" message shows for 6 seconds). Savings and debts also have History, and deleting one deletes its history. Budget expenses also have Link to saving or debt / Change link (with Remove Link)
- **Budget:** Sort by amount (Largest first / Smallest first; with 2+ entries), Rename, Move to folder, Change to Budget / Savings & debts (only while empty), Delete (no confirm; Undo for 6 seconds; deletes its entries)
- **Undo:** a deleted entry, budget or history value is hidden at once and only deleted on the server after 6 seconds, when another delete starts, or when the app goes to the background (so it isn't lost if iOS closes it). One at a time (`startDelete` in `data.tsx`)
- **Folder:** Rename, Delete (only when empty, so there's nothing to confirm; otherwise it's greyed out with "Move or delete what's inside first" under it)

### Reordering
- **Press and hold** a row or card (about a third of a second), then drag, to reorder entries within their section (income, expenses, savings or debts) and cards within a list. No drag handles. A tap still reaches the row's links and buttons, moving before the hold completes scrolls instead, and letting go after a drag isn't a tap. Persist the result to `sort_order`
- **Sort by amount** (budget menu) is a one-off reorder, not a mode: income (or savings) stays above expenses (or debts), each largest or smallest first; equal amounts keep their order (`sortByAmount` in `selectors.ts`). Rows can be moved by hand afterwards

---

## Formatting

- en-GB number formatting, two decimal places, thousands separators
- Positive: `+ £ 9,289.30` · Negative: `- £ 5,430.59` · Zero: `£ 0.00` (no sign)
- Note the spaces between sign, £ and number
- Balance colours: positive = green, negative = red-orange, zero = grey
- Entry amounts take their **type** colour, even when zero

---

## Visual tokens (approximate, sampled from screenshots)

The app follows the phone's light or dark mode (`prefers-color-scheme`). Tokens are redefined for dark in `index.css`; never hard-code a colour.

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand` | `#4F46B5` | `#9D96F5` | Chevrons, ⋮ icons, links, outlines, filled brand buttons |
| `bar` | `#4F46B5` | `#2F2A6E` | Header bar and status bar |
| `income` | `#4FB291` | `#5FCAA4` | Income text, Add Income button |
| `expense` | `#EA5A2F` | `#FF7B4F` | Expense text, Add Expense button |
| `action` | `#0079B6` | `#45AEE8` | Add Budget button |
| `bg` | `#F2F1ED` | `#16171B` | Page background |
| `surface` | `#FFFFFF` | `#25272D` | Cards, rows, footer |
| `raised` | `#FFFFFF` | `#33363E` | Menus, which float above cards |
| `text` | `#3A3A3A` | `#ECEBF3` | Budget and folder names |
| `muted` | `#8C8C8C` | `#9A9AA6` | Labels, notes, zero balances |
| `folder` | `#C9C4EE` | `#4A4490` | Folder icon fill, keypad operator keys |
| `line` | 10% black | 10% white | Row dividers and borders |

- Coloured buttons use `button-fill` with `[--fill:var(--color-…)]`: solid with white text in light mode, outlined in dark mode (as Fudget does)

- Font: system UI stack (`-apple-system, …`)
- Large, readable numbers. Entry rows compact (about 54px); budget and folder cards roomier (about 68px)
- Buttons: rounded (about 12px radius), bold white text
- Respect the iOS safe areas (notch and home indicator) in the header and bottom bars

### Motion
Quiet and quick, all in `index.css` (`--ease-out`, `--ease-in-out`), and all off when the phone is set to reduce motion.
- Entrances ease out; moves across the screen (rows making way while reordering, the header balance sliding in) ease in-out. No bounce
- Menus start at 95% from the exact button tapped (`transform-origin`), in 180ms, and shrink back into it when dismissed. Exits are about 20% shorter than entrances (menu 145ms, Undo message 160ms vs 200ms)
- Buttons scale to 0.97 while pressed (`press`); list rows highlight instead
- Rows of a list arrive 30ms apart when its screen opens (`stagger`), not when one is added later. New draft rows and cards fade up (`enter`)
- The keypad rises from the bottom, except when going straight from one amount to another
- Totals (hero, footer) pulse briefly when they change, confirming a save (`usePulse`)
- Nothing tweens while under a finger (dragging, swiping); a swiped row rubber-bands past its ends

---

## Out of scope for Phase 1 (do NOT build yet)

Bottom tab bar (Starred / Settings / Account) · stars / repeating entries · paid status and Paid balance · partials · dates on budget entries (only savings & debts history has dates) · charts (including of savings & debts history) · search · other sorting options (sorting by name, or a lasting sort mode) · CSV export / print · copy / move entries between budgets · carry-over balances · passcode / Face ID lock · themes beyond following the phone's light/dark mode · multiple currencies · reminders · importing Fudget data.

These are candidates for later phases. Structure the code so they can be added without rewrites.

---

## Repo layout (target)

```
/
├── CLAUDE.md
├── docker-compose.yml      # local image build only
├── .github/workflows/      # test, build and publish to GHCR
├── deploy/                 # compose file, update and backup scripts, host setup guide
├── Dockerfile              # multi-stage: build web → copy into PocketBase image's pb_public
├── pocketbase/
│   ├── pb_migrations/      # schema as JS migrations, committed to git
│   └── pb_data/            # gitignored, persistent volume
└── web/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── lib/pb.ts       # PocketBase client
        ├── lib/money.ts    # pence <-> display formatting, sum helpers (unit tested)
        ├── components/
        └── routes/         # / , /folder/:id , /budget/:id , /entry/:id/history , /entry/:id/link
```

## Development

- App name: **Tally** (set in `web/vite.config.ts`, `web/index.html` and `web/src/routes/Login.tsx`)
- First-time setup: `./pocketbase/install.sh` downloads the binary (pinned version; keep in step with the `Dockerfile`), and `npm install` in `web/`
- Run PocketBase locally (`./pocketbase serve` in `pocketbase/`) and Vite (`npm run dev` in `web/`), with Vite proxying `/api` and the admin UI (`/_/`) to PocketBase
- Migrations: write `new Collection({...})` fields as plain objects with a `type`. Field class instances there are silently dropped, along with the collection's rules
- `amount_pence` is deliberately not `required`, because PocketBase treats 0 as blank and £0.00 entries are valid
- Sign-in is a minimal extra screen at `/login`, needed because all data requires auth. Public sign-up is disabled by the initial migration
- Menu icons: the root header menu shows who's signed in and holds Sign out; the budget detail header menu holds the same actions as a budget's ⋮
- All records are held in memory by `web/src/lib/data.tsx`, kept current by realtime, plus a refetch on reconnect and on returning to the foreground
- Bind Vite to `0.0.0.0` so the app can be tested on an iPhone over the LAN
- iOS home-screen app: the screen-edge colours and the blur under the status bar are controlled by WebKit, which looks for a fixed, full-width, opaque element at each edge. `web/src/components/EdgeBars.tsx` provides them; don't remove them or make them translucent. The page itself is pinned (`body` fixed) and only each screen's `<main>` scrolls. Neither can be checked in a desktop browser or headless Chromium, only on the phone
- Define the schema in **migrations** (`pb_migrations/`), never only by clicking in the admin UI
- Unit test `money.ts`: formatting, signs, zero handling, totals and sums typed on the keypad (`npm test`)
- End-to-end tests in `web/e2e/` (`npm run e2e`, after `./pocketbase/install.sh`): the built app against a throwaway PocketBase with the real migrations, in an iPhone-sized Chromium, covering the main journeys (keypad sums, editing in place, undo, reordering and sorting, savings & debts with links and history, hiding the balance, the pinned layout, dark mode). Add a test with each feature

## Deployment

Pull-based: nothing on the LAN accepts inbound connections from outside.

1. Push to `main` runs `.github/workflows/build.yml`: unit and end-to-end tests, then a `linux/amd64` image pushed to `ghcr.io/petheridge/budget-app`, tagged `latest` and the full commit SHA. Pull requests and manual runs on other branches test but don't publish.
2. On the host, cron runs `deploy/update.sh` every 5 minutes, which pulls and restarts if the image changed. `deploy/backup.sh` runs nightly, briefly stopping the app to copy `pb_data/` consistently to the NAS and keeping 14 copies.
3. To roll back, set `IMAGE_TAG=<sha>` in the host's `.env`, which also stops automatic updates until it's removed.

- Target: Debian 12 unprivileged LXC on Proxmox (`nesting=1,keyctl=1`), home LAN only (remote access later via VPN, never exposed publicly). Setup steps are in `deploy/README.md`
- `deploy/` holds what the host runs. The root `docker-compose.yml` builds the image locally, for testing the `Dockerfile` only
- Migrations apply automatically when the container starts, and automigrate is off in production: schema changes must come from `pb_migrations/` in git
- Secrets (the GHCR token) live only on the host, never in the repo
- HTTPS is needed later for full PWA/service-worker support on iOS (Caddy with a DNS challenge, or Tailscale Serve). Not required to start.

## Conventions

- TypeScript strict mode
- Small, readable components; no state library unless one is clearly needed (React state + the PocketBase SDK is enough)
- Keep this file updated when scope or decisions change

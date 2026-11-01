# Budget App — Project Brief

A self-hosted, simplified clone of the **Fudget** iOS budget planner. Runs on a home Proxmox server and is used from iPhone as an installable web app (PWA).

**Phase 1 goal:** separate budgets containing income (+) and expense (−) entries, with a clear total. Nothing more. Keep it simple; resist adding features not listed here.

**Added since:** *savings & debts* budgets, which hold things like an ISA or a mortgage as current values recorded over time, with a monthly catch-up (see screen 4). They're the one place the app deals with dates.

Use our own app name, icon and styling. Copy Fudget's *behaviour and layout*, not its branding or assets.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | **PocketBase** (single binary, SQLite) | Auth, REST API, realtime subscriptions, admin UI at `/_/` |
| Frontend | **React + Vite + TypeScript** | |
| Styling | **Tailwind CSS** | Colours as theme tokens (see below) |
| Data access | `pocketbase` JS SDK | Use realtime subscriptions so two phones stay in sync |
| Reordering | `@dnd-kit` | Drag handles on rows/cards |
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
- `sort_order` — number

### `snapshots` (history of savings and debts)
- `entry` — relation → `entries`, required, cascade delete
- `amount_pence` — number (integer, positive): the value at the time
- `created` — the date it was recorded
- Written whenever a saving's or debt's value is set: when it's added, when an edit changes the amount, and for every item at each catch-up (unchanged ones too). The latest snapshot matches the entry's `amount_pence`

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
- Footer row: "All Budgets Balance:" (root) or "Folder Balance:" (in a folder), with a large coloured total on the right

### 2. Budget detail

**Header (brand colour):** back button labelled with the parent ("‹ 📁 Monthly" or "‹ Budgets") · budget name as title · menu icon.

**Entry list:** flat full-width white rows separated by thin grey lines (not cards).
- Entry name (left) **and** amount (right) are both coloured by type: green for income, red-orange for expense. Medium/semibold weight.
- If a note exists, show it as a second line under the name: small grey text with a pencil icon.
- Vertical divider, then an brand-coloured ⋮ menu column on the right.
- Empty space below the list shows the light grey background.

**Bottom (pinned):**
- Two side-by-side buttons: green **Add Income** and red-orange **Add Expense**
- Summary footer split by a vertical divider:
  - Left, small labels: `Income:` (green value), `Expenses:` (red value)
  - Right: "Balance" label in grey, with a large coloured balance below it

### 3. Adding and editing entries
- **Add Income** / **Add Expense** adds a blank row inline at the end of the list (no pop-up, so the screen doesn't jump when the keyboard opens), with `type` set by the button pressed. Name is focused; Return opens the amount keypad, whose Save saves the row. Tapping outside the row and keypad also saves it; a blank name discards it; an empty amount saves as £0.00; ✕ cancels
- **Edit** (from an entry's ⋮) opens a sheet, pre-filled: Name, Amount (£), Note (optional), Save / Cancel. Notes are added here
- Also use a simple sheet to add or rename a budget or folder (name only, plus the folder to put it in).

### Amount keypad
- Every amount (inline add, Edit sheet, Catch Up) opens the app's own keypad, not the iPhone keyboard, so amounts can be sums: digits, `.`, ⌫, + − × ÷ and a full-width Done (Save on an inline row, Next on Catch Up until the last item)
- A line above the keys shows the sum and its result ("576 ÷ 12   = £ 48.00"), or what's wrong ("Can't be less than £ 0.00"), and Done then stays open
- With a value already there, a digit replaces it and an operator carries on from it: "+ 250" adds to the current value
- × and ÷ come before + and −. In each part of a sum the first number is money (up to 2 decimal places) and multipliers and divisors are plain numbers. Each part is rounded to the penny, all in integer pence (`evaluateAmount` in `money.ts`, unit tested). Only the result is stored, not the sum
- It's part of the page (fixed to the bottom, above sheets), so nothing jumps. A computer keyboard types into it too
- Names and notes still use the iPhone keyboard

### 4. Savings & debts budget
- Chosen when adding a budget ("Budget" or "Savings & debts"), or from the ⋮ menu while a budget is empty
- Same header and row layout as a budget. Each row: name and current value in the type colour (savings green, debts red-orange), and under the value a small "▲ £ 250.00 since 1 Oct" (or "No change since…"). Tapping a row opens its **history**: every recorded value with its date and change, newest first
- Bottom: **Add Saving** (green), **Add Debt** (red-orange), **Catch Up** (brand). Adding works inline, as for entries. Footer: Savings, Debts and a large **Net worth**
- **Catch Up** opens a full page (not a sheet) listing every item with its current value filled in. Tap a value to change it with the keypad (start with + or − to add or take away; Next moves down the list); Save records today's value for every item. A blank value keeps the current one
- Debts are entered as positive amounts owed

### ⋮ menus
- **Entry:** Edit, Delete (confirm). Savings and debts also have History, and deleting one deletes its history
- **Budget:** Rename, Move to folder, Change to Budget / Savings & debts (only while empty), Delete (confirm; deletes its entries)
- **Folder:** Rename, Delete (only allowed when empty; otherwise explain why)

### Reordering
Drag to reorder entries within a budget, and cards within a list. Persist the result to `sort_order`.

---

## Formatting

- en-GB number formatting, two decimal places, thousands separators
- Positive: `+ £ 9,289.30` · Negative: `- £ 5,430.59` · Zero: `£ 0.00` (no sign)
- Note the spaces between sign, £ and number
- Balance colours: positive = green, negative = red-orange, zero = grey
- Entry amounts take their **type** colour, even when zero

---

## Visual tokens (approximate, sampled from screenshots)

| Token | Hex | Use |
|---|---|---|
| `brand` | `#4F46B5` | Header bar, chevrons, ⋮ icons |
| `income` | `#4FB291` | Income text, Add Income button |
| `expense` | `#EA5A2F` | Expense text, Add Expense button |
| `action` | `#0079B6` | Add Budget button |
| `bg` | `#F2F1ED` | Page background |
| `surface` | `#FFFFFF` | Cards, rows, footer |
| `text` | `#3A3A3A` | Budget and folder names |
| `muted` | `#8C8C8C` | Labels, notes, zero balances |
| `folder` | `#C9C4EE` | Folder icon fill |

- Font: system UI stack (`-apple-system, …`)
- Large, readable numbers; generous row height (about 64–72px)
- Buttons: rounded (about 12px radius), bold white text
- Respect the iOS safe areas (notch and home indicator) in the header and bottom bars

---

## Out of scope for Phase 1 (do NOT build yet)

Bottom tab bar (Starred / Settings / Account) · stars / repeating entries · paid status and Paid balance · partials · dates on budget entries (only savings & debts history has dates) · charts (including of savings & debts history) · search · sorting options · CSV export / print · copy / move entries between budgets · carry-over balances · passcode / Face ID lock · themes / dark mode · multiple currencies · reminders · importing Fudget data.

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
        └── routes/         # / , /folder/:id , /budget/:id , /budget/:id/catch-up
```

## Development

- App name: **Tally** (set in `web/vite.config.ts`, `web/index.html` and `web/src/routes/Login.tsx`)
- First-time setup: `./pocketbase/install.sh` downloads the binary (pinned version; keep in step with the `Dockerfile`), and `npm install` in `web/`
- Run PocketBase locally (`./pocketbase serve` in `pocketbase/`) and Vite (`npm run dev` in `web/`), with Vite proxying `/api` and the admin UI (`/_/`) to PocketBase
- Migrations: write `new Collection({...})` fields as plain objects with a `type`. Field class instances there are silently dropped, along with the collection's rules
- `amount_pence` is deliberately not `required`, because PocketBase treats 0 as blank and £0.00 entries are valid
- Sign-in is a minimal extra screen at `/login`, needed because all data requires auth. Public sign-up is disabled by the initial migration
- Menu icons: the root header menu holds Sign out; the budget detail header menu holds the same actions as a budget's ⋮
- All records are held in memory by `web/src/lib/data.tsx`, kept current by realtime, plus a refetch on reconnect and on returning to the foreground
- Bind Vite to `0.0.0.0` so the app can be tested on an iPhone over the LAN
- iOS home-screen app: the screen-edge colours and the blur under the status bar are controlled by WebKit, which looks for a fixed, full-width, opaque element at each edge. `web/src/components/EdgeBars.tsx` provides them; don't remove them or make them translucent. The page itself is pinned (`body` fixed) and only each screen's `<main>` scrolls. Neither can be checked in a desktop browser or headless Chromium, only on the phone
- Define the schema in **migrations** (`pb_migrations/`), never only by clicking in the admin UI
- Unit test `money.ts`: formatting, signs, zero handling, totals and sums typed on the keypad

## Deployment

Pull-based: nothing on the LAN accepts inbound connections from outside.

1. Push to `main` runs `.github/workflows/build.yml`: web tests, then a `linux/amd64` image pushed to `ghcr.io/petheridge/budget-app`, tagged `latest` and the full commit SHA. Manual runs on other branches test but don't publish.
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

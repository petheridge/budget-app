# Budget App — Project Brief

A self-hosted, simplified clone of the **Fudget** iOS budget planner. Runs on a home Proxmox server and is used from iPhone as an installable web app (PWA).

**Phase 1 goal:** separate budgets containing income (+) and expense (−) entries, with a clear total. Nothing more. Keep it simple; resist adding features not listed here.

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
- `sort_order` — number

### `entries`
- `budget` — relation → `budgets`, required, cascade delete
- `name` — text, required
- `amount_pence` — number (integer, always **positive**)
- `type` — select: `income` | `expense`
- `note` — text, optional
- `sort_order` — number

### Access rules
Household app: any authenticated user can read/write all records. No public access. Create users via the PocketBase admin UI.

---

## Calculations

- **Entry signed value** = `+amount` for income, `−amount` for expense
- **Budget balance** = sum of its entries' signed values
- **Budget screen footer**: Income total, Expenses total, Balance
- **Folder Balance** (shown inside a folder) = sum of balances of budgets *directly* in that folder
- **All Budgets Balance** (root screen) = sum of balances of budgets at *root level only*. Budgets inside folders are **not** included. This matches observed Fudget behaviour.

---

## Screens

### 1. Budget list (root, and inside a folder — same screen)

**Header (orange):**
- Root: title "Budgets", add-folder icon, menu icon
- Inside a folder: back button labelled with the parent ("‹ Budgets"), folder icon + folder name as title, add-folder icon

**List:** white rounded cards with a soft shadow, gap between cards, on a light warm-grey background.
- **Budget card:** name (left, dark grey, regular weight) · balance (right, coloured, bold) · orange chevron · vertical divider · orange ⋮ menu
- **Folder card:** peach folder icon · name · orange chevron · ⋮ menu. No balance shown on the card.
- Folders and budgets share one ordered list.
- Tap a card to open it.

**Bottom (pinned):**
- Full-width blue **Add Budget** button
- Footer row: "All Budgets Balance:" (root) or "Folder Balance:" (in a folder), with a large coloured total on the right

### 2. Budget detail

**Header (orange):** back button labelled with the parent ("‹ 📁 Monthly" or "‹ Budgets") · budget name as title · menu icon.

**Entry list:** flat full-width white rows separated by thin grey lines (not cards).
- Entry name (left) **and** amount (right) are both coloured by type: green for income, red-orange for expense. Medium/semibold weight.
- If a note exists, show it as a second line under the name: small grey text with a pencil icon.
- Vertical divider, then an orange ⋮ menu column on the right.
- Empty space below the list shows the light grey background.

**Bottom (pinned):**
- Two side-by-side buttons: green **Add Income** and red-orange **Add Expense**
- Summary footer split by a vertical divider:
  - Left, small labels: `Income:` (green value), `Expenses:` (red value)
  - Right: "Balance" label in grey, with a large coloured balance below it

### 3. Add / edit sheet (bottom sheet or modal)
- **Add Income** / **Add Expense** opens the sheet with `type` already set by the button pressed
- Fields: Name, Amount (numeric keypad, £), Note (optional)
- Save / Cancel. Editing uses the same sheet, pre-filled.
- Also use a simple sheet to add or rename a budget or folder (name only, plus the folder to put it in).

### ⋮ menus
- **Entry:** Edit, Delete (confirm)
- **Budget:** Rename, Move to folder, Delete (confirm; deletes its entries)
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
| `brand` | `#F7931E` | Header bar, chevrons, ⋮ icons |
| `income` | `#4FB291` | Income text, Add Income button |
| `expense` | `#EA5A2F` | Expense text, Add Expense button |
| `action` | `#0079B6` | Add Budget button |
| `bg` | `#F2F1ED` | Page background |
| `surface` | `#FFFFFF` | Cards, rows, footer |
| `text` | `#3A3A3A` | Budget and folder names |
| `muted` | `#8C8C8C` | Labels, notes, zero balances |
| `folder` | `#FDD49B` | Folder icon fill |

- Font: system UI stack (`-apple-system, …`)
- Large, readable numbers; generous row height (about 64–72px)
- Buttons: rounded (about 12px radius), bold white text
- Respect the iOS safe areas (notch and home indicator) in the header and bottom bars

---

## Out of scope for Phase 1 (do NOT build yet)

Bottom tab bar (Starred / Settings / Account) · stars / repeating entries · paid status and Paid balance · partials · dates on entries · charts · search · sorting options · CSV export / print · copy / move entries between budgets · carry-over balances · passcode / Face ID lock · themes / dark mode · multiple currencies · reminders · importing Fudget data.

These are candidates for later phases. Structure the code so they can be added without rewrites.

---

## Repo layout (target)

```
/
├── CLAUDE.md
├── docker-compose.yml
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
        └── routes/         # / , /folder/:id , /budget/:id
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
- Define the schema in **migrations** (`pb_migrations/`), never only by clicking in the admin UI
- Unit test `money.ts`: formatting, signs, zero handling and totals

## Deployment

- Target: Debian LXC on Proxmox, home LAN only (remote access later via VPN, never exposed publicly)
- `git pull && docker compose up -d --build`
- Persist `pb_data/` as a volume; back it up to the NAS
- HTTPS is needed later for full PWA/service-worker support on iOS (Caddy with a DNS challenge, or Tailscale Serve). Not required to start.

## Conventions

- TypeScript strict mode
- Small, readable components; no state library unless one is clearly needed (React state + the PocketBase SDK is enough)
- Keep this file updated when scope or decisions change

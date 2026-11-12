# Service Charge Explainer

Answer "why did my service charge go up?" with evidence, not guesswork.

Built for UK block managers at the Real Estate GB hackathon. For a building's
year-on-year service-charge bill, it traces every line to evidence and marks it:

- **✓ Explained**: matched evidence covers at least 80% of the line
- **⚠ Partial**: some evidence found
- **✗ Not found**: nothing matched. It never invents evidence.

Evidence sources:

| Source | What we read | How |
|---|---|---|
| Cortile | Bill lines, maintenance tickets, contractors, units, leases | Local SQLite file (read-only) |
| Invoices | Contractor invoices: uploaded PDFs and Gmail (incl. PDF attachments) | AI extracts supplier, invoice no., date, total, ticket ref |
| Bank | Payments from the building's client account | TrueLayer Open Banking (read-only) or a statement CSV |
| Documents | Insurance schedule, lease, management agreement | Uploaded PDFs / Google Drive |

**Matching and maths happen in code.** Tickets match on building + category + financial year.
Invoices match on amount ±£1, contractor and ticket ref. Payments match on amount ±£1,
payee and a 60-day window. The AI (OpenAI, `gpt-5.5` by default) is only used to **read**
documents and emails and to **write** plain-English text (owner replies, letter explanations),
citing only evidence that was found.

## Pages

- `/`: landing page
- `/onboarding`: connect sources step by step, plus a sample walkthrough
- `/app`: dashboard (verdict, items needing attention, evidence trail, draft reply to owner)
- `/letters`: create a service-charge statement PDF for a building or a flat. You review and
  approve each line, then the server re-derives every figure and produces the PDF.

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the keys you need
pnpm dev
```

Then:

1. Put the Cortile hackathon database at `data/cortile-hackathon.sqlite` (not committed).
2. Optional demo evidence pack for Fir House (`bld_0853`):
   `node scripts/make-demo-pack.mjs` generates invoice PDFs, an insurance schedule and
   `data/bank-transactions.csv` from the real ticket data. They are clearly marked as demo files.
3. Keys (`.env.local`, never committed):
   - `OPENAI_API_KEY` (+ optional `OPENAI_MODEL`): document reading and writing
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: Gmail + Drive (read-only OAuth)
   - `TRUELAYER_*`: bank connection (`TRUELAYER_ENV=sandbox` uses Mock Bank, login `john` / `doe`)
   - `SESSION_SECRET`: 32+ random chars (`openssl rand -base64 32`)

Without an OpenAI key the app falls back to a regex PDF reader and template text.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm format`

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui, motion, pdf-lib, unpdf, node:sqlite.

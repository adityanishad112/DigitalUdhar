# Digital Udhar

**Scan. Take Udhaar. Pay Later.**

A verified digital-udhaar (credit) + QR-payment platform for everyday Indian shops. A customer scans a shop's counter QR, requests *udhaar* (buy-now-pay-later), the merchant accepts, and an **immutable ledger** tracks every rupee until the balance is cleared through a **signature-verified sandbox payment** — or with cash recorded by the shopkeeper.

The whole product is built around one core loop, and every step of it works end-to-end:

```text
LOGIN → MERCHANT QR → TAKE UDHAAR → MERCHANT ACCEPT → IMMUTABLE LEDGER
      → SANDBOX PAYMENT → WEBHOOK VERIFY → RECEIPT → ₹0 CLEARED
```

---

## Table of contents

- [What makes it trustworthy](#what-makes-it-trustworthy)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [The 60-second demo walkthrough](#the-60-second-demo-walkthrough)
- [Architecture](#architecture)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Feature status (honest tiers)](#feature-status-honest-tiers)
- [Switching to real infrastructure](#switching-to-real-infrastructure)

---

## What makes it trustworthy

These are hard invariants, enforced in the backend and covered by tests — not UI conveniences:

- **No AI anywhere.** No chatbots, no "AI insights", no AI credit scoring. Every number is deterministic SQL over the ledger.
- **All money math lives in the backend.** The frontend never computes a balance — it only *renders* paise returned by the API. Money is stored as **integer paise** end-to-end (no floats).
- **The ledger is append-only.** There is no "edit transaction" or "delete transaction". Corrections are new **adjustment** rows with an audit trail; balances are recomputable from the transaction history.
- **Payments are never trusted from the frontend.** A payment is marked successful **only** when our webhook receives an **HMAC-SHA256-signed** event, verifies the signature, and passes an **idempotency** check keyed on the event ID. A duplicate webhook can never create a duplicate repayment.
- **Identity data is minimized.** Aadhaar/PAN are encrypted at rest (AES-256-GCM), masked, consented, and audited — full government IDs are never returned to merchants.
- **Merchant privacy is real.** Shop A cannot see a customer's udhaar at Shop B. Each merchant only ever sees its own relationship with a customer.
- **Every sensitive/admin action is written to an immutable audit log.**
- **Four roles** — `CUSTOMER`, `MERCHANT`, `STAFF`, `ADMIN` — enforced by RBAC middleware and per-resource ownership checks.
- **Three languages** — English, Hindi (हिन्दी), and Hinglish — switchable anywhere in the UI.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| **Backend** | Node ≥ 20, TypeScript (ESM), Express 4 |
| **ORM / DB** | Drizzle ORM (Postgres dialect) over **PGlite** — a real Postgres engine running in-process, persisted to `backend/.data`. Zero install; swappable for a real Postgres server via one env var. |
| **Auth** | OTP → JWT, bcrypt-hashed OTPs, role-based access control |
| **Payments** | Pluggable `PaymentGateway` interface with a faithful Razorpay-style **mock gateway** (signed webhooks, orders, fees, refunds) |
| **Jobs** | `node-cron` sweeper for reminders + overdue / promise-to-pay state transitions |
| **Frontend** | React 18 + TypeScript, Vite 6, Tailwind 3, React Router 6, TanStack Query 5, Zustand 5, axios |
| **QR** | `html5-qrcode` (scan) + `qrcode` (generate) |
| **Tests** | Vitest — ledger math, accept/reject, repayment, idempotency, signature rejection, RBAC, full-loop integration |

---

## Quick start

**Prerequisites:** Node ≥ 20 and npm. Nothing else — no Postgres, Docker, or SMS gateway required.

```bash
# 1. From the repo root — installs backend + frontend (npm workspaces)
npm install

# 2. Create the backend env file from the example
cp backend/.env.example backend/.env

# 3. Run both apps together (api on :4000, web on :5173)
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

On first boot the backend automatically **migrates PGlite and seeds demo data** (controlled by `AUTO_SEED=true`). Watch the API console — it prints the demo logins and the Sharma General Store counter-QR token.

> **Windows note:** if `cp` isn't available in your shell, copy `backend/.env.example` to `backend/.env` however you prefer. The values in the example file work as-is for local development.

Other useful scripts (run from the repo root):

```bash
npm test          # backend test suite (Vitest)
npm run dev:backend   # API only
npm run dev:frontend  # web only
npm run build     # typecheck + build both apps
npm run db:reset  # wipe and re-seed the local PGlite database
```

---

## Demo accounts

Log in with **any** of these mobile numbers. This is a demo build: `EXPOSE_OTP_IN_RESPONSE=true`, so the API returns the OTP and the login screen **auto-fills it** — signing in is effectively one tap. Pick the matching **role** on the login screen.

| Role | Mobile | Who |
| --- | --- | --- |
| **Customer** | `8000000001` | Rahul Kumar |
| **Merchant** | `9000000001` | Rajesh Sharma — *Sharma General Store* |
| **Merchant** | `9000000002` | Suresh Gupta — *Gupta General Store* |
| **Admin** | `9999900000` | Platform Admin |

The seed also creates live demo udhaar (through the real service flow, so the ledger, receipts, and evidence timeline are all genuine):

- Rahul @ **Sharma**: ₹1,500 active, due in ~10 days
- Rahul @ **Sharma**: ₹800 active, **overdue** (due 3 days ago)
- Rahul @ **Gupta**: ₹300 active — *Sharma can never see this (privacy)*

You can log in as **any 10-digit number** to create a fresh account for that role.

---

## The 60-second demo walkthrough

1. **Log in as the customer** (`8000000001`, role *Customer*). The home screen shows total outstanding across shops — every figure comes from the API.
2. **Scan / open a shop.** Tap **Scan**. In a desktop browser without a camera, use the Sharma **counter-QR token** printed in the API console (or open the shop from an existing khata).
3. **Take Udhaar.** Enter an amount (e.g. ₹500), an optional due date and note, and submit. The request appears as `REQUESTED`.
4. **Accept as the merchant.** Log in as `9000000001` (role *Merchant*) → **Requests** → **Accept**. This posts the udhaar to the immutable ledger and creates the digital agreement + evidence timeline.
5. **Pay it down (sandbox).** Back as the customer, open the udhaar → **Pay** ₹300. The mock gateway creates an order, then fires a **signed webhook** to the backend, which verifies the signature, posts a repayment to the ledger, and issues a **receipt**. Outstanding drops to ₹200.
6. **Clear it.** Pay the remaining ₹200 → balance hits **₹0** → the udhaar flips to **CLEARED**. Both dashboards update from the server.

Spot-check paths worth trying: the **overdue** ₹800 udhaar, **promise-to-pay**, **cash repayment** (recorded by the merchant), **payment failure**, **refund/adjustment**, **disputes**, and an **invalid QR** token.

## Architecture

### Ledger — the single source of truth

- `ledger_accounts` — one row per (merchant, customer) pair, with a cached `balance_paise`. Unique on `(merchant_id, customer_id)`.
- `ledger_transactions` — **append-only**, signed `amount_paise` (`+` increases outstanding: udhaar / positive adjustment; `−` decreases: repayment / refund / negative adjustment), plus `type`, `balance_after_paise`, `method` (DIGITAL/CASH), `udhaar_id`, `created_by`, `metadata`, `created_at`. Never updated or deleted.
- Every write goes through a single `postLedgerTransaction(...)` service that inserts the row **and** updates the cached balance inside one DB transaction. The balance is always recomputable from the rows.

### Payments — never trust the client

`create-order` creates a `payment` (CREATED) + `payment_order` with an idempotency key. A mock checkout endpoint simulates success/failure and fires a **server-to-server webhook** to `/payments/webhook` signed with `PAYMENT_GATEWAY_WEBHOOK_SECRET`. The handler:

1. verifies the HMAC-SHA256 signature (bad signature → rejected),
2. deduplicates on `payment_webhooks.event_id` (unique),
3. in **one** DB transaction: marks the payment SUCCESS, posts the ledger repayment, clears the udhaar if the balance reaches 0, creates a receipt, and notifies.

A duplicate webhook is a no-op. A real `RazorpayGateway` can be dropped in behind the same interface using real keys — documented, not built.

### Auth & privacy

`POST /auth/send-otp` (mobile + role) generates a 6-digit OTP, stored hashed with an expiry, and returned in the response in dev mode. `POST /auth/verify-otp` creates the user if new and returns a JWT + user. RBAC middleware plus per-resource ownership checks enforce that a merchant only ever sees its own relationship with a customer, and that full government IDs are never exposed.

**API surface** (no AI endpoints anywhere):
`/auth/*`, `/identity/*`, `/merchants`, `/qr/{generate,revoke,:token}`, `/udhaar/{request,:id/accept,:id/reject,:id/promise-to-pay,:id/cash-repayment}`, `/udhaar[/:id]`, `/payments/{create-order,webhook,mock/pay,:id,:id/refund}`, `/adjustments`, `/disputes[/:id]`, `/notifications`, `/reminders`, `/reports`, `/receipts[/:id]`, `/settlements`, `/family/permissions`, `/admin/*` (incl. `/admin/audit-logs`).

---

## Environment variables

Backend only — the frontend has **no secrets** (it talks to the API through the Vite dev proxy). Copy `backend/.env.example` → `backend/.env`. The example values are safe defaults for local development.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` / `production` |
| `PORT` | API port (default `4000`) |
| `APP_BASE_URL` | Frontend origin — used for CORS and building QR deep-links (`http://localhost:5173`) |
| `API_BASE_URL` | API origin (`http://localhost:4000`) |
| `DATABASE_URL` | Leave **empty** to use embedded PGlite. Set to a `postgres://…` URL to use a real Postgres server (same migrations apply). |
| `PGLITE_DATA_DIR` | Where PGlite persists (`./.data/udhar`) |
| `JWT_SECRET` | JWT signing secret — **change in production** |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `OTP_TTL_SECONDS` | OTP validity window (default `300`) |
| `EXPOSE_OTP_IN_RESPONSE` | Dev convenience — returns the OTP in the API response. **MUST be `false` in production.** |
| `PAYMENT_GATEWAY_PROVIDER` | `mock` (or `razorpay` once wired) |
| `PAYMENT_GATEWAY_KEY_ID` | Gateway public key id |
| `PAYMENT_GATEWAY_KEY_SECRET` | Gateway secret — backend only |
| `PAYMENT_GATEWAY_WEBHOOK_SECRET` | HMAC secret used to sign/verify webhooks |
| `GATEWAY_FEE_PERCENT` | Fee % the mock gateway deducts for settlement reporting |
| `IDENTITY_ENC_KEY` | 32-byte (64 hex) AES-256-GCM key for identity encryption. Generate with `openssl rand -hex 32`. |
| `AUTO_SEED` | Seed demo data on boot if the DB is empty |

`.env` and all `*.env` files are gitignored; only `*.env.example` is committed.

---

## Testing

```bash
npm test
```

The Vitest suite covers the financial core and the security invariants, including:

- ledger math and outstanding balance after accept / partial repayment / full repayment,
- accept and reject flows and credit-limit enforcement,
- **duplicate-webhook idempotency** (a repeated event posts no second repayment),
- **invalid webhook signature is rejected**,
- unauthorized access / role-escalation are blocked (RBAC),
- a **full-loop integration test**: request → accept → pay (partial then full) → ₹0 cleared.

---

## Project structure

```text
JamaBaaki/
├─ package.json            # npm workspaces + dev/test/build scripts (concurrently)
├─ backend/
│  ├─ .env.example
│  └─ src/
│     ├─ core/             # config, db client, errors, jwt, crypto, money, ids, logger, http
│     ├─ db/               # schema/ (split by module), migrate.ts, seed.ts
│     ├─ middleware/       # auth, rbac, validate (zod), rateLimit, error, audit
│     ├─ modules/          # auth, identity, merchants, qr, udhaar, ledger, payments,
│     │                    # receipts, settlements, notifications, disputes, adjustments,
│     │                    # collections, family, audit, reports, admin
│     ├─ workers/          # node-cron reminder + overdue/promise sweeper
│     └─ tests/
└─ frontend/
   ├─ vite.config.ts       # proxies /api → :4000, @ → ./src
   └─ src/
      ├─ components/        # ui/ (Button, Card, Badge, Money, Modal, states…) + layout/
      ├─ pages/             # Landing, Login, customer/*, merchant/*, admin/*, UdhaarDetail…
      ├─ services/          # axios client + typed hooks (TanStack Query)
      ├─ store/             # Zustand auth + ui
      ├─ lib/               # api, types, status, dates, money helpers
      └─ i18n/              # en (source of truth) + hi + hinglish
```

---

## Feature status (honest tiers)

**Tier 1 — fully built, run + tested end-to-end (the mandated MVP)**
Monorepo & tooling · schema + migrations + demo seed · OTP auth + JWT + RBAC · merchant registration/profile · QR generate / revoke / validate · QR scanner · take-udhaar → accept/reject → digital agreement + human transaction IDs · immutable ledger · sandbox payment → order → signed webhook (verify + idempotent) → ledger update → receipt → auto-clear at ₹0 · partial + full repayment · customer / merchant / admin dashboards · landing page · financial + security tests.

**Tier 2 — implemented (lighter manual verification)**
Mock identity verification (encrypted, masked, consented) · evidence-vault timeline · promise-to-pay · reminders + overdue state machine · disputes · adjustments + refunds · cash repayment · merchant reports/analytics (plain SQL) · audit logs · admin dashboard · i18n (en/hi/hinglish) + language switch · credit limits.

**Tier 3 — scaffolded, partial (flagged honestly)**
Billing/invoices, inventory, family access, offline sync, a dedicated settlements UI, multi-shop management, and advanced rule-based fraud review exist as schema and/or module stubs but are **not** fully wired into the UI. Treat these as foundations, not finished features.

---

## Switching to real infrastructure

- **Real Postgres:** set `DATABASE_URL=postgres://…` and run `npm run db:migrate`. The same Drizzle migrations apply — no schema changes.
- **Real payments:** implement a `RazorpayGateway` behind the existing `PaymentGateway` interface, set `PAYMENT_GATEWAY_PROVIDER=razorpay`, and provide real `PAYMENT_GATEWAY_KEY_ID` / `_KEY_SECRET` / `_WEBHOOK_SECRET`. The webhook verification and idempotency logic is already gateway-agnostic.
- **Real SMS OTP:** set `EXPOSE_OTP_IN_RESPONSE=false` and plug an SMS provider into the OTP send step.

---

*Built as an MVP-first, integrity-first reference — the financial core and the security guarantees are the product.*
#   J a m a B a a k i  
 
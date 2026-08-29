# Digital Udhar 🧾
**Scan. Take Udhaar. Pay Later.**

In India, small shopkeepers have run informal credit ("udhaar") for their regular customers for generations — tracked in a paper notebook, with no receipts, no reminders, and no proof if a dispute comes up. **Digital Udhar digitizes that exact relationship** instead of replacing it: a customer scans a shop's counter QR, requests udhaar, the merchant accepts it on the spot, and every rupee from there on is tracked in an **immutable ledger** — until the balance is cleared, either through a signature-verified sandbox payment or cash recorded by the shopkeeper.

🔗 **Live Demo:** [digital-udhar-ek0s.onrender.com](https://digital-udhar-ek0s.onrender.com)

### How it works
```
LOGIN → MERCHANT QR → TAKE UDHAAR → MERCHANT ACCEPT → IMMUTABLE LEDGER
      → SANDBOX PAYMENT → WEBHOOK VERIFY → RECEIPT → ₹0 CLEARED
```
A customer logs in, scans a merchant's QR code, and requests an amount as udhaar. The merchant approves it, which posts an entry to a ledger that can only ever be added to — never edited or deleted. When the customer repays (digitally or in cash), the balance updates and, once it hits ₹0, the udhaar is marked cleared with a receipt as proof.

## Highlights
This project is built around trust and correctness first — these aren't just features, they're hard rules enforced in the backend and covered by tests:
- **No AI, anywhere** — every score/number is deterministic SQL run over the ledger, not a model's guess. This keeps money math fully explainable and auditable.
- **Append-only ledger** — transactions can't be edited or deleted. Corrections are added as new adjustment entries, so the full history is always intact and balances can be recomputed from scratch at any time.
- **Trusted payments only** — the frontend never decides if a payment succeeded. Only a signed webhook (HMAC-SHA256) from the payment gateway can mark a payment as successful, and duplicate webhooks are ignored so money is never double-counted.
- **Encrypted identity** — Aadhaar/PAN numbers are encrypted at rest (AES-256-GCM) and masked before being shown to anyone, including merchants.
- **Strict merchant privacy** — each merchant only sees their own relationship with a customer. Shop A has no visibility into what a customer owes Shop B.
- **RBAC** — four distinct roles (Customer, Merchant, Staff, Admin), each restricted to their own permissions and data.
- **Multi-language** — the entire UI works in English, Hindi, and Hinglish, since that's how these conversations actually happen in real shops.

## Tech Stack
| Layer | Choice |
|---|---|
| Backend | Node ≥20, TypeScript, Express |
| DB/ORM | Drizzle ORM over PGlite — a real Postgres engine that runs in-process, so no separate database install is needed for local dev |
| Auth | OTP → JWT, bcrypt, RBAC |
| Payments | Pluggable gateway interface with a Razorpay-style mock — swappable for a real gateway later without touching the core logic |
| Frontend | React 18, TypeScript, Vite, Tailwind, TanStack Query, Zustand |
| Tests | Vitest (ledger math, RBAC, idempotency, full-loop integration) |

## Quick Start
No Postgres, Docker, or SMS setup required — everything runs locally out of the box.
```bash
npm install
cp backend/.env.example backend/.env
npm run dev
```
This installs both backend and frontend (npm workspaces), then runs the API (`:4000`) and web app (`:5173`) together. Open `http://localhost:5173`. Demo data auto-seeds on first boot — check the API console for the printed demo logins.

## Demo Accounts
Since there's no real SMS provider wired up, OTPs are shown directly in the app for demo purposes — login is effectively one tap.
| Role | Mobile | Who |
|---|---|---|
| Customer | 8000000001 | Rahul Kumar |
| Merchant | 9000000001 | Rajesh Sharma — Sharma General Store |
| Merchant | 9000000002 | Suresh Gupta — Gupta General Store |
| Admin | 9999900000 | Platform Admin |

## Testing
```bash
npm test
```
The test suite focuses on the parts that matter most for a financial product: ledger math after accept/repayment, accept/reject flows, webhook signature verification (a bad signature is rejected), duplicate-webhook idempotency (a repeated event never double-posts a repayment), RBAC enforcement, and a full end-to-end flow — request → accept → pay (partial then full) → ₹0 cleared.

## Feature Status
Rather than overselling, features are labeled honestly by how complete they are:
- **Tier 1 — fully built & tested:** the core loop — auth, QR flow, udhaar request/accept, ledger, sandbox payments, receipts, dashboards
- **Tier 2 — implemented, lighter testing:** identity verification, disputes, adjustments, reminders, reports, audit logs, i18n
- **Tier 3 — scaffolded, not fully wired up:** invoices, inventory, multi-shop management, offline sync

## Switching to Real Infrastructure
The demo runs on an in-process database and a mock payment gateway so it's easy to try, but both are designed to be swapped for the real thing:
- **Real Postgres:** set `DATABASE_URL` to a real connection string and run the existing migrations — no schema changes needed.
- **Real payments:** implement a `RazorpayGateway` behind the existing `PaymentGateway` interface and set the corresponding keys — webhook verification and idempotency logic already work regardless of provider.
- **Real SMS OTP:** turn off `EXPOSE_OTP_IN_RESPONSE` and plug in an SMS provider.

---
*Built as an MVP-first, integrity-first reference — the financial core and the security guarantees are the actual product, not just a UI demo.*

**New here? Read SETUP.md — it has every command, in order.**

# RentalHub (Phase 1)
- packages/core  — locked business engine (cashback ladder, 7-day window, commission/waiver, dual-verified checkout)
- packages/theme — Teal Fresh tokens shared by RN + web
- apps/api       — zero-dependency reference API (in-memory; swap for Postgres + JWT)
Run: `npm test` · `npm run api`

## Phase 2 — apps/mobile (React Native CLI, plain JavaScript, Tenant flow)
Run API: `npm run api` · Mobile: see apps/mobile/README.md (bare React Native CLI — no Expo)
Screens: Welcome, Login, OTP, Role, Tenant Home, Register Property (5-step), Wallet + cashback ladder, Checkout (QR scan → confirm → live timeline), Vacancy 7-day countdown.

## Phase 3 — Owner app + consent flow
Owner tabs: Dashboard (PROPERTY→ROOM→TENANT→OCCUPIED/VACANT→PLACEMENT→COMMISSION spine, needs-attention, KPIs), Vacancy (DAY 1–7), Commission (Potential/Due/Paid/Waived + history + pay).
Flows: Owner checkout confirm/dispute, 7-page consent (no upfront payment · 20% on success · 7-day fee waiver · not lost-rent compensation).
New API: GET /owner/dashboard · GET /checkout/:room · POST /commission/pay · `node apps/api/smoke-owner.mjs`
Test both sides on one device: login as Tenant → Checkout; then re-login as Owner → confirm.

## Phase 4 — Agent app
Agent tabs: Dashboard (Assigned/Pending/Verified/Rejected/Revisit/Completed + next visits) · Tasks (filters) · QR Tags · History · Profile(soon).
VerifyProperty (5 steps): details + owner contact → KYC → geo-tag WHOLE property → QR tag for EVERY room (rounded tag design) → checklist/notes. Reject / Revisit need a reason.
Rules live in packages/core/verification.js (tested). Verify success mints the tenant's 30% deferred token.
Smoke: `node apps/api/smoke-agent.mjs`. Native deps: @react-native-community/geolocation, react-native-svg, react-native-qrcode-svg.

## Phase 5 — Web app (apps/web: React + Vite, Admin / Agent / Owner)
Run: `npm run api` (port 4000) then `cd apps/web && npm install && npm run dev` → http://localhost:5173
Admin: Dashboard (13 KPI cards + 11 charts, SVG, no chart lib), Properties, Rooms, Users, Verification, Vacancy, Placement, Cashback, Commission, Payments, QR tags, AI logs, Audit logs.
Agent/Owner web read the same tables scoped to their own data (`/me/*`); owner cannot see cashback or other owners' rooms.
Charts marked "Sample data" are placeholders until real history exists; Occupancy + KPIs are live.
Smoke tests: apps/api/smoke-{owner,agent,admin,scope}.mjs

## Phase 6 — Real authentication + database design
- **Auth (working, tested):** phone OTP → signed JWT (HS256, 7-day). `x-role` header is gone. Roles come from the token; agent/admin accounts can't be self-assigned; new phones become tenant/owner accounts.
- **Security fixes:** ownership checks on every room/checkout/property/commission route (a tenant can't read another tenant's room, an owner can't confirm someone else's checkout), OTP is single-use, 5-try lockout, resend throttle, `devCode` is never returned when `NODE_ENV=production`.
- **Demo logins (dev):** Tenant 9876543210 · Owner 9425011111 · Agent 9770012345 · Admin 9000000000. The OTP is shown on screen in dev mode.
- **Database (designed, NOT yet connected):** `apps/api/prisma/schema.prisma` (16 models), `docker-compose.yml`, `.env.example`.
  Next: `cd apps/api && npm i prisma @prisma/client && npx prisma validate && npx prisma migrate dev` then swap the in-memory `db` for Prisma.
- Before launch: real SMS provider in `sendSms()`, refresh tokens, rate limiting per IP.

## Phase 7 — Tenant Search + Booking + Payment
Mobile (Tenant): Search tab (city selector, text search, quick chips, Filters sheet: type · rent · beds · furnishing · amenities · sort, "Near me" distance), Property details (verified badge, amenities, Maps link, owner first name only), Book (move-in date, duration, rent breakdown with cashback), Payment (summary, method, processing, success, failed), Bookings tab (Active/Past), Booking details (move-in timeline, cancel with full refund). Wallet now reads live data.
API: GET /listings(+/:roomId) · GET /wallet · POST/GET /bookings, /bookings/:id/{pay,cancel,confirm,reject,movein}. Admin web: Bookings page.
Rules (core/booking.js, tested): payable = one month's rent − cashback, NO extra fees; registration counts as booking #1 so a registered tenant's first booking is #2 (30%), then #3 (10%), #4+ (7%); dormant token gives ₹0 and the UI says "scan QR at checkout to unlock"; token is held while a booking is pending and redeemed at move-in; cancel/reject = full refund + token released; move-in inside the 7-day window creates the owner's 20% commission, after it → waived.
Assumptions to confirm with client: what a tenant pays at booking (modelled as first month's rent), allowed stay lengths (3/6/11/12 offered), payment gateway.

## Phase 8 — Profile · KYC · Notifications · History · Saved (+ first admin actions)
Mobile (all roles): Profile tab → My profile (edit), KYC (intro → submit → under review → verified / rejected → re-upload, history kept), Notifications (unread badge, mark read), Help/Privacy/Terms (placeholder copy), Log out.
Tenant extras: Rental history + portable trust profile (KYC, stays, no-dispute, cities), Payment history (with refunds), Cashback history, Saved homes (heart on property details).
API: GET/POST /profile · GET /kyc, POST /kyc/submit, POST /kyc/:userId/{verify,reject} · GET /history · GET /saved, POST /saved/:roomId · GET /notifications, POST /notifications/read.
Notifications are fired from real events: verification done/rejected, cashback ready, checkout request, vacancy started, booking received/confirmed/rejected/moved-in, placement + commission (due or waived), KYC outcome, plus admin alerts.
KYC stores only the ID TYPE (+ doc reference) — never the ID number; must be 18+.
Admin web: new KYC + Notifications pages; first write actions — verify/reject KYC, confirm / reject-and-refund / mark-moved-in on bookings (open a row).

## Phase 9 — Tenant property registration, end to end
Mobile: 6-step Register Property (property → room & rent → amenities → photos/video → owner & visit → review) with real uploads and retry-safe submit; Property status screen (submitted → agent assigned → visit scheduled → verification in progress → verified / failed / revisit, + KYC, owner consent, cashback token); Tenant Home now live (/home): current stay, booking, registered property, wallet. Checkout uses the tenant's own room (was hard-coded).
Agent: schedules the visit (chips) and starting verification notifies the tenant. Owner: Consent flow shows the real property a tenant registered under their number; Accept activates it (rooms appear on the owner dashboard), "Not now" declines.
API: POST /uploads (JPG/PNG/WebP ≤5 MB, MP4 ≤25 MB, content sniffed) · GET /files/:id · POST /properties · GET /properties/mine · GET /home · POST /properties/:id/{schedule,start} · GET /owner/consents · POST /owner/consent/:propertyId.
Rules added: unverified or owner-unconsented rooms are never searchable; other rooms in a registered property stay "verification pending" until the agent confirms them; checkout needs an occupied room with an assigned QR tag; owner's number must differ from the tenant's; one registration per address per tenant.
Fixed: malformed JSON used to crash the server; request bodies are now size-limited (1 MB, 40 MB for uploads).
Dev-only: uploads go to a temp folder — production needs S3/GCS with presigned uploads, malware scanning and per-user limits.

## Phase 10 — Durable storage (data now survives restarts and crashes)
`SQLITE_PATH=./data/rentalhub.db npm run api` → data, uploads and the audit trail persist. `DATABASE_URL=postgres://… ` (after `npm i pg`) stores the same data in PostgreSQL.
How it works (apps/api/src/persist.js): the API loads saved data at start (or saves the demo data on first run) and writes every change in ONE database transaction **before** answering a state-changing request. If the save fails the client gets a 500 and nothing is reported as done; the next save retries. The audit entry is saved in the same transaction as the change it records. Only changed records are written.
Tested: diffing, ordering, failed save + retry, SQLite rollback, and a real crash (SIGKILL) → restart → data/ids/notifications/audit intact, seed data not duplicated.
Limits — read before launch:
- **Run ONE API instance.** Data is held in memory and saved as documents; two instances would overwrite each other. Scaling out, SQL reporting and data-warehouse needs → migrate to the relational schema (`prisma/schema.prisma`, 16 models) behind a repository layer; the 37 tests are the safety net for that move.
- The PostgreSQL adapter is written but NOT yet run against a real Postgres (none in this sandbox). SQLite uses Node 22's built-in module, which Node still labels experimental.
- Back up regularly: SQLite → `sqlite3 data/rentalhub.db ".backup backup.db"` (plus the `data/uploads` folder); Postgres → `pg_dump`.
- OTP codes and rate-limits are in memory (a restart just means "request a new code").
- Uploads are local files; production should use S3/GCS (presigned) + malware scan.

## Phase 11 — WhatsApp / AI verification
The assistant (apps/api/src/ai.js) contacts the **tenant** (after the QR scan) and the **owner** (after the tenant confirms), understands replies (YES / NO / a date — English, Hinglish, Hindi: packages/core/src/reply.js) and feeds them into the SAME checkout rules as the app — a room becomes vacant only after both confirm, whichever channel they used.
- Unclear replies: asks again twice, then hands over to a person (Manual review). Owner "NO" → Disputed. A date in the reply counts as a correction.
- Timers (assumptions, configurable in ai.js): reminder after 6 h, hand-over after 48 h of silence. A sweep runs every 5 min.
- Admin web: **Checkout review** (approve / reject-with-reason a disputed or unanswered exit) and **WhatsApp** (masked transcripts).
- Webhook: `GET/POST /webhooks/whatsapp` — Meta handshake + HMAC-signed inbound; bad/missing signature → 401; retried messages are ignored (idempotent); production refuses to run it without WHATSAPP_APP_SECRET.
- Tenants can't skip the QR scan on WhatsApp either. Owner-facing wording never says "compensation".
- Without WHATSAPP_TOKEN/PHONE_ID a **mock provider** records messages (all tests use it). The real Meta sender is written but NOT yet run against Meta.
- Before launch: WhatsApp only allows a business to START a chat with an **approved template**; register templates for the owner/tenant messages in ai.js, and get Meta business verification.
Fixed on the way: `crossVerify` used to overwrite INITIATED/QR_SCANNED with AWAITING_PARTIES; a verified exit now works for rooms with no cashback token.
Tests: 49 (core rules, reply parser, API, uploads, persistence/crash-restart, WhatsApp flows).

## Phase 12 — Mobile app moved from Expo to React Native CLI (bare), JavaScript only
No Expo and no TypeScript anywhere in the project (enforced by `npm run check` in apps/mobile and by the test suite).
Swapped: expo-camera → react-native-vision-camera (QR scanning) · expo-image-picker → react-native-image-picker · expo-location → @react-native-community/geolocation · expo-file-system → fetch+FileReader · expo-status-bar → React Native StatusBar · (new) react-native-keychain keeps people logged in securely.
Setup, step by step: apps/mobile/README.md. Root npm workspaces were removed so each app keeps its own node_modules (React Native's Gradle/Metro need that).

## Phase 13 — Admin actions, real reports, SMS provider
- **Admin web:** assign / reassign an agent (picker shows each agent's open workload), send a property back for revisit, reject with a reason. The admin does NOT "verify" a property: verification stays an in-person agent job (checklist + whole-property geo-tag + a QR on every room) so the core promise can't be bypassed.
- **Reports** (new): registration funnel + owner conversion, agent performance (incl. average hours to verify), placements (within-7-days rate, average days vacant), commission (due / paid / waived — waived shown as "not charged, never paid to owners"), cashback by state, bookings, checkouts. Each section downloads as CSV (formula-injection safe).
- **Dashboard charts are now live:** computed from real timestamps (6 weekly buckets); a chart with no activity says so instead of showing made-up data. The "sample data" badges are gone.
- **Settings** (new, read-only): locked business rules (20%, 7 days, 30%→30→10→7, owner-found rooms excluded, repairs excluded) + system status (storage, WhatsApp/SMS provider, environment).
- **SMS:** `SMS_PROVIDER=msg91` sends OTPs through MSG91 (India needs DLT-registered sender + template). Production refuses to start without a provider. Limits: 5 OTPs/hour per phone, 20/hour per IP; provider errors are logged but never shown to users and don't lock the user out. The MSG91 sender is written but NOT yet run against MSG91.
Tests: 62 (adds admin actions, reports from real data, settings, SMS limits/failure, CSV safety).

## Phase 14 — Production hardening + deployment
API: `/health` endpoint; security headers (nosniff, no framing, no-store, HSTS in production); CORS allow-list (`CORS_ORIGINS`; production with none = same-origin only); per-IP rate limit (300/min, `RATE_LIMIT_PER_MIN`; webhooks exempt — they're signature-protected) on top of the OTP limits; one JSON log line per request (path only — no tokens/OTPs/bodies); startup refuses bad production config and lists every problem (`npm run check:env`); graceful shutdown on SIGTERM (finish saving, close DB, exit 0); JWT secret must be ≥32 chars in production.
Deploy kit: `Dockerfile.api`, `Dockerfile.web` (+ Caddy with automatic HTTPS and `/api` proxy), `docker-compose.prod.yml` (Postgres + API + web), `.env.production.example`, `scripts/backup.sh`, GitHub Actions CI, and **DEPLOY.md** (pre-launch checklist: DLT, Meta templates, legal text, open client decisions, backups, monitoring).
Tests: 69. The Docker/Caddy/compose files were checked for syntax only — they have NOT been built or run here (no Docker in this sandbox).

## Phase 15 — Staff provisioning + production starts empty
- A production server no longer contains demo data (Rahul, Shree Residency, …); demo data is for development and tests only (`SEED_DEMO`). The first admin comes from `BOOTSTRAP_ADMIN_PHONE`; with no admin the server refuses to start.
- Admin web **Staff** page: add agents/admins by name + mobile, deactivate/reactivate. Staff accounts can't be self-registered (a stranger who picks the "agent" role still becomes a tenant). Giving an existing user a staff role lets them switch to it after login.
- Every request now re-checks the account server-side: a deactivated user (or one who lost a role) is rejected immediately even with an unexpired token. Rails: not yourself, not the last admin, not an agent with open properties.
Tests: 75 (adds staff lifecycle and a real brand-new production boot).

## Phase 16 — Owner app completed (Properties · Rooms · Placements) + Owner/Agent web dashboards
Owner mobile: **Properties** (list → property with rooms → room), **Placements** (in-progress rooms with the DAY 1–7 countdown, "New tenant found", potential 20% commission; history with commission due / paid / **Commission Waived**). Room page: current tenant (name, mobile, since, KYC), placement window, tenant history timeline, placements, QR tag.
Privacy: an owner sees their OWN tenant's name + mobile, but a prospective tenant only by first name until they move in; owners can never open another owner's property/room (403).
Web: Owner dashboard (spine, KPIs, what needs attention) and Agent dashboard (counts, next visits) replace the placeholder text.
Data fix: a verified exit now ends the tenancy (end date) and empties the room — the old tenant no longer has access to it and rental history shows the stay as finished.
Tests: 77.

## Phase 17 — Real payments (Razorpay) + a production hole closed
**Security fix:** the old one-step `/bookings/:id/pay` marked a booking paid without taking money. It now exists only with the mock provider (development); with a real gateway it answers 403, and production refuses to start without `PAYMENT_PROVIDER=razorpay`.
Flow: `POST /bookings/:id/pay/start` (server creates an order for the exact amount, in paise; tapping twice reuses the order) → the phone pays through Razorpay → `POST /bookings/:id/pay/confirm` (the server verifies Razorpay's signature `HMAC-SHA256(order_id|payment_id)`; forged, replayed, wrong-order and other-tenant confirmations are refused; a retried confirm is harmless).
Webhook `POST /webhooks/razorpay` (signed): `payment.captured` finishes a payment the app never confirmed (crash / lost signal); money that arrives for an already-closed booking is refunded automatically; wrong amounts are ignored; duplicates are harmless; `refund.processed` marks the refund done.
Refunds go through the gateway (cancel / reject / room-taken-while-paying). A refund the gateway rejects is kept as RETRY, flagged to admin, and retried every 5 minutes (up to 10 times) — the cancellation itself never fails.
Mobile: Payment screen runs start → Razorpay checkout (`react-native-razorpay`) → confirm; the dev server uses a one-step simulation. The Razorpay native SDK path has NOT been run (needs a device + test keys).
Tests: 83. Not yet run against real Razorpay (use test mode first). Note: with the 30% cashback cap a booking can never become ₹0, so there is no "free booking" path to maintain.

## Phase 18 — KYC ID photos (private) + setup guide
ID photos are uploaded to a PRIVATE store (never the public photo folder), images only with content checks, max 6 per person. Only the owner of the photo, admins, and the agent assigned to a property that person registered can open it (`GET /private/<id>`, every request checked, `no-store`). KYC submission now requires your own photo, used once. **Retention:** photos are deleted 90 days after the KYC decision (`KYC_DOC_RETENTION_DAYS`); unused uploads after 7 days; the decision itself is kept. Mobile: take or choose a photo in KYC; admin web: "View ID photo" in the KYC drawer. Compose now persists the whole /data volume (public + private photos) and the backup script archives it.
New: `SETUP.md` (install → run → go live → publish), root shortcuts (`npm run setup / web / mobile / mobile:android / native:add`).

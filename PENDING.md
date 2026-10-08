# RentalHub — what is done and what is pending (updated after your CozyHaven UI changes)

Legend: ✅ built and tested · ◐ partly built · ❌ not built.
Checked against (1) the business plan, (2) your original brief, (3) the **CozyHaven Light UI blueprint PDF** (section 13 "Final screen checklist"), (4) the code you uploaded.

## 1. Where things stand
- **Backend (API):** complete for the business model — registration → agent verification → owner consent → QR checkout with dual confirmation (app + WhatsApp assistant) → vacancy → 7-day placement → 20% commission or **Commission Waived** → cashback ladder; payments (Razorpay flow), refunds, KYC with private ID photos, staff accounts, reports, audit trail, hardening, deploy kit. **~97 automated tests pass.**
- **Mobile app:** all three roles work end to end in code. **Your CozyHaven UI is kept exactly as you made it** (colours, icons, splash, header, cards, app icon). The app has been built on your machine (Android project, icons and pinned library versions are in your upload). iPhone: project exists but `pod install` has not been run yet.
- **Web app:** Admin is complete; Owner and Agent have basic dashboards + tables. **Tenant web does not exist.**
- **Not yet done by anyone:** a full test with the real services (PostgreSQL, MSG91, Razorpay, WhatsApp, Docker) and a complete run on real devices of every flow.

## 2. Your changes — reviewed
I compared every file of your `mobile.zip`, `web.zip`, `api.zip` with the last version I gave you.
- **api:** unchanged. **mobile / web:** only UI files changed (theme tokens, `Icon`, `BrandLogo`, `AppHeader`, `Splash`, light sidebar, styles, app icons). **No business logic was touched.**
- **You fixed a bug of mine:** in my last web version `App.jsx` used `OwnerHome` / `AgentHome` without importing them, so the Owner and Agent web dashboards would crash. Your added import is the fix. My syntax check could not see this kind of mistake, so I added a permanent guard (`npm run check`, also part of `npm test`) that fails whenever a component is used but not imported. It catches that exact bug (tested) and passes on your code.
- Merged result: **your UI + my backend + the push-notification code**; every test passes (97/97).
- **Notes — not changed, your call (UI is yours):**
  1. `Icon name="phone"` (login screen) does not exist in `Icon.js`, so it falls back to the **home** icon. One-line fix: add a `phone` glyph.
  2. `App.js` turns off **text scaling** app-wide (`allowFontScaling = false`). The blueprint's accessibility section asks for readable text; people who use large system fonts will not get larger text. Allow scaling with a cap (e.g. `maxFontSizeMultiplier = 1.3`) if you want a middle way.
  3. `scripts/generate-app-icons.js` needs `pngjs`, which is not in `package.json`; it works today only because another library happens to install it. Add `pngjs` to devDependencies so it keeps working.
  4. iPhone bundle id is still the template default (`org.reactjs.native.example.RentalHub`). Change it before Firebase/TestFlight/App Store. Android id `com.rentalhub` is fine — decide the final one now (changing later = a new store listing).

## 3. Screen checklist from the CozyHaven PDF (section 13)
**Tenant mobile**
| Screen | Status |
|---|---|
| Splash, onboarding (welcome), login/OTP | ✅ |
| Home, search, filters, property detail, photo gallery | ✅ |
| Map / list toggle | ❌ list only (+ "Open in Maps" button) |
| Manager (listing owner) profile | ◐ owner first name + verified badge only |
| **Schedule a visit** | ❌ |
| Booking confirmation, QR checkout, AI confirmation status | ✅ |
| Vacancy status (for the room the tenant left) + 7-day view | ◐ cashback + checkout status exist; the tenant-side vacancy/placement screens from the brief are missing |
| Favorites, notifications, profile | ✅ |
| **Messages** | ❌ |
**Owner mobile**
| Dashboard, property list, property detail, rooms, tenants, vacancy, placements, commission, checkout requests, consent, QR tag, profile | ✅ |
| Add / edit property, media upload | ❌ (the plan has the *tenant* register the property; confirm whether owners should too) |
| Payments / earnings | ◐ commission due / paid / waived + history (rent collection is "future" in the plan) |
| **Messages** | ❌ |
**Agent mobile**
| Dashboard, assignments, verification queue, inspection checklist, KYC check, QR tags, visit scheduling, tasks, profile | ✅ |
| **Photo / video capture during verification** | ❌ (also in your original brief: items 10–11) |
| **Messages** | ❌ |
**Web**
| Admin: dashboard, properties, rooms, users, staff, verification, vacancy, placement, bookings, cashback, commission, KYC, QR, AI logs, WhatsApp, checkout review, reports, audit, settings, notifications | ✅ |
| Admin: **Payments** | ◐ shows commission only — tenant booking payments and refunds are not listed |
| Admin: **AI Intelligence** (vacancy forecast, demand, pricing, placement probability) | ❌ (only AI *verification logs* exist) |
| Owner web: dashboard, rooms, vacancy, commission | ✅ basic |
| Owner web: property detail, tenants, requests, payments, analytics, settings, messages | ❌ |
| Agent web: dashboard, assigned properties, verification, QR | ✅ basic |
| Agent web: inspection detail, KYC review, visits, tasks, messages | ❌ |
| **Tenant web** (landing, search, filters, map, detail, booking, account, saved, messages, bookings) | ❌ none |
**Global:** loading ✅ · empty ✅ · error + retry + offline ✅ · success ✅ · permission prompts ✅ · confirmation dialogs ✅ (system alerts) · **toast notifications ❌** · responsive web ◐ (sidebar collapses; the blueprint's tablet/mobile layouts are not tuned).
**Design deliverables:** your UI is implemented in code. A **Figma file is not produced** (I cannot create Figma files); I can export tokens JSON + a component spec sheet.

## 4. Pending work — development (13 items)
| # | Item | Size | Needs a decision? |
|---|---|---|---|
| D1 | **Agent photo + video capture** (and upload) inside verification — your original brief | M | no |
| D2 | **Tenant vacancy / placement screens** for the room they left (day 1→7, commission waived wording) — original brief §5.7 | S–M | no |
| D3 | **Admin Payments ledger**: booking payments + refunds + commission together, matched with Razorpay | S–M | no |
| D4 | **Messages / inbox** (tenant ↔ owner ↔ agent) — in the PDF, not in the business plan | L | **yes**: who may talk to whom, can phone numbers be shared, moderation |
| D5 | **Schedule a visit** (tenant books a viewing before booking) | M | **yes**: does an agent/owner attend, what if the owner is unavailable |
| D6 | **Map + list view** of properties | M | needs a Google Maps / Mapbox key |
| D7 | **Owner add / edit property + media** | M | **yes**: plan says the tenant registers |
| D8 | **Tenant web** marketplace (landing, search, detail, booking, account) | L | no (design is in the PDF) |
| D9 | **Owner web** (property detail, tenants, requests, payments, analytics, settings) + **Agent web** (inspection, KYC, visits, tasks) | L | no |
| D10 | **AI Intelligence page** — suggestions with reason + confidence (never changes business state). First version rule-based on your own data; meaningful only after some weeks of real data | M–L | **yes**: which signals, who sees them |
| D11 | **Polish:** toasts, skeleton loaders, tablet/mobile web breakpoints, text-size accessibility, `phone` icon, **Hindi** | M | Hindi: yes/no |
| D12 | **Prisma / relational migration** (needed only when you outgrow one server) | L | no |
| D13 | **Monitoring** (error tracking), external **security review**, device end-to-end tests, Figma tokens + component sheet | M | no |

## 5. Pending — needs you
| # | Item |
|---|---|
| Y1 | Tell me which flows you ran on the phone and what broke (I only know it builds). iPhone: `cd ios && bundle exec pod install`. |
| Y2 | Accounts and approvals: domain + server, MSG91 **DLT** template, Razorpay activation, Meta WhatsApp templates, Play / Apple developer accounts, **Firebase** (for push), legal text. |
| Y3 | A dry run on a staging server with the real services (SETUP.md Parts 3–4). |
| Y4 | Push notifications are **built** (server + app); to switch them on follow SETUP.md Part 7. |

## 6. Suggested order
1. **D1, D2, D3** — small gaps in what your original brief already asked for.
2. **D11 (partly)** — toasts, `phone` icon, text size — quick wins that keep your design.
3. Decide D4–D7, D10 with your client (they change the business scope, not just screens).
4. **D8, D9** — tenant web and the remaining owner / agent web pages.
5. **D12, D13** before real traffic.

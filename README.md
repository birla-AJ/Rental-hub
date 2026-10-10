<div align="center">

# 🏠 RentalHub

### Next-Generation Smart Rental Platform

**Dual-Verified Exits · 7-Day Fast Placement · Deferred Cashback Rewards · Multi-Role Workflows**

[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![React Native](https://img.shields.io/badge/React_Native-CLI-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-teal.svg)]()

---

</div>

## 📌 Overview

**RentalHub** is an end-to-end, multi-sided rental housing ecosystem crafted to bring speed, transparency, and trust to urban rental markets. Unlike traditional classified portals that list stale or unverified brokers' ads, RentalHub enforces strict **in-person verification**, **QR-tagged room checkouts**, and an automated **7-day placement engine** backed by a business-logic core.

RentalHub serves four primary roles in one unified platform:

- 🧑‍💼 **Tenants:** Discover physically verified homes, earn deferred cashback tokens, verify move-out via room QR scans, and build a portable rental trust profile.
- 🏢 **Property Owners:** Zero upfront fees, guaranteed 7-day fast tenant placement (20% success-only commission, 100% waived if unplaced in 7 days), live vacancy countdowns, and tenant verification.
- 🛵 **Field Agents:** Step-by-step physical property verification, GPS geofencing, room QR tag deployment, and KYC document audit.
- 🛡️ **Super Admins:** Real-time business KPIs, agent dispatch, automated AI logs, escrow & payment settlements, audit trails, and staff provisioning.

---

## 🚀 Key Differentiators & Core Features

### 1. 🔁 The Deferred Cashback Ladder

Tenants receive deferred cashback tokens upon successful exit verification. Cashback unlocks automatically on their next bookings according to a mathematically verified ladder:

- **Booking #2 (First repeat booking):** Up to **30% cashback** applied instantly at checkout.
- **Booking #3:** **10% cashback**.
- **Booking #4+:** **7% lifetime cashback**.

### 2. ⏱️ 7-Day Placement Window & Commission Waiver

- When a room becomes vacant, a strict **7-day countdown window** begins.
- If a new tenant is placed within 7 days: Owner pays a success fee (20% of 1 month's rent).
- If unplaced after Day 7: **The commission is 100% waived (₹0)** — owners never pay for slow placements, and the platform absorbs the placement effort.

### 3. 📱 Dual-Verified QR Checkouts

- Move-out requires the tenant to physically scan the room's unique **QR Tag** (`rentalhub://room/<id>`).
- Confirmation is dual-verified by both the tenant and property owner (via the app or WhatsApp AI Assistant).
- Prevents sudden unannounced vacancies, protects security deposits, and starts the vacancy clock in real time.

### 4. 💳 Production Payment Infrastructure (Razorpay)

- In-app booking payment via Razorpay Checkout (UPI, Cards, NetBanking).
- Server-side order creation in paise with HMAC-SHA256 signature verification.
- Webhook resilience (`payment.captured`, `payment.failed`, `refund.processed`).
- Instant automatic full refunds if a room is reserved by another party simultaneously.

### 5. 🔔 Push Notifications & Messaging

- **Firebase Cloud Messaging (FCM HTTP v1):** Zero-dependency OAuth2 service account integration delivering instant push alerts on Android/iOS devices.
- **Transactional Notifications:** Booking approvals, visit schedules, verification results, cashback token activations, and vacancy alerts.

### 6. 🔐 Privacy & Sensitive Data Protection

- KYC photo uploads are stored in an isolated **private store** (never served publicly).
- Strict RBAC: only the owner, assigned agent, and super-admin can inspect KYC files.
- Automated data retention purges ID files 90 days after verification decisions.

---

## 🏗️ Architecture & Monorepo Structure

RentalHub is organized as a clean, modular monorepo:

```
rentalhub/
├── packages/
│   ├── core/                  # Pure domain business rules (Cashback, 7-day window, Commissions)
│   └── theme/                 # Shared design tokens ("Teal Fresh" palette, typography, radii)
├── apps/
│   ├── api/                   # High-performance Node.js REST API with Prisma ORM & Auth
│   │   ├── prisma/            # Relational PostgreSQL schema (16 models)
│   │   └── src/               # Zero-dependency HTTP server, FCM, Auth, Hardening, Storage
│   ├── mobile/                # Bare React Native CLI app for Android & iOS (Tenant / Owner / Agent)
│   │   ├── android/           # Native Android setup (Keystore signing, Firebase google-services)
│   │   └── src/               # Modern animated UI, QR scanner, Offline Keychain auth
│   └── web/                   # React 18 + Vite responsive web dashboard (Admin / Staff / Owner)
│       └── src/               # Glassmorphic UI, live SVG metric charts, multi-table management
├── deploy/
│   └── Caddyfile              # Reverse proxy with automatic HTTPS and /api forwarding
├── Dockerfile.api             # Production container for API + Prisma Client
├── Dockerfile.web             # Multi-stage production container for Web app + Caddy
├── docker-compose.prod.yml    # Complete production stack (PostgreSQL 16 + API + Caddy Web)
└── .env.production            # Production environment template
```

---

## 🛠️ Tech Stack

| Layer                  | Technology                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------- |
| **Mobile App**         | React Native (Bare CLI 0.74+), Native VisionCamera, react-native-keychain, Vector Icons |
| **Web Dashboard**      | React 18, Vite, Custom CSS Glassmorphism, Zero-dependency SVG charts                    |
| **Backend API**        | Node.js 22 LTS, Native `node:http` & `node:crypto`, Prisma ORM 5.x                      |
| **Database**           | PostgreSQL 16 (Relational models, indexed queries, durable ACID transactions)           |
| **Reverse Proxy**      | Caddy v2 (Automatic Let's Encrypt TLS, gzip compression, `/api` proxying)               |
| **Payments**           | Razorpay (Orders API, Webhooks, HMAC verification)                                      |
| **Push Notifications** | Firebase Cloud Messaging (HTTP v1 OAuth2 Service Account)                               |
| **Deployment**         | Docker & Docker Compose on AWS EC2 (Ubuntu 22.04 / 24.04 LTS)                           |

---

## 📦 Getting Started & Local Development

### Prerequisites

- **Node.js**: v20 or v22 LTS
- **npm**: v10+
- **PostgreSQL** or Docker (for database)
- **Android Studio / Xcode** (for mobile development)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/rentalhub.git
cd rentalhub
```

### 2. Setup the Backend API

```bash
cd apps/api
npm install
cp .env.example .env     # Configure JWT_SECRET and credentials
npx prisma generate
npm start                # Starts API on http://localhost:4000
```

### 3. Setup the Web App

```bash
cd ../../apps/web
npm install
npm run dev              # Starts Web Dashboard on http://localhost:5173
```

### 4. Setup the Mobile App

```bash
cd ../../apps/mobile
npm install

# Run on Android emulator / physical device:
npm run android

# Run on iOS simulator (macOS):
cd ios && pod install && cd ..
npm run ios
```

---

## 🚢 Production Deployment (AWS EC2)

The production stack runs as three coordinated containers via Docker Compose:

1. **`db`**: PostgreSQL 16 with a persistent data volume.
2. **`api`**: Node.js backend running Prisma and business logic.
3. **`web`**: Caddy serving the pre-built React SPA and proxying `/api` requests with automatic HTTPS.

### One-Command Deployment

On your AWS EC2 instance:

```bash
# 1. Clone project
git clone <your-repo> /opt/rentalhub && cd /opt/rentalhub

# 2. Launch production containers
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# 3. Synchronize database schema
docker compose -f docker-compose.prod.yml exec api npx prisma db push

# 4. Verify deployment health
curl http://localhost/api/health
```

---

## 📱 Mobile App Release Build (Android)

The Android configuration includes an auto-configured `release.keystore` and Google Services:

```bash
cd apps/mobile/android

# Build Release APK
./gradlew assembleRelease

# Build Google Play Bundle (.aab)
./gradlew bundleRelease
```

Outputs:

- **APK**: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`
- **AAB**: `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

---

## 🔒 Security Best Practices

- **Zero Secret Commits:** `.gitignore` blocks `.env*`, `service-account*.json`, `google-services.json`, and keystore files.
- **HS256 Signed JWTs:** Enforces strict role checks and tamper protection.
- **HMAC Signatures:** All payment and webhook calls verify signatures prior to state changes.
- **Rate Limiting:** Per-IP sliding-window rate limiters prevent brute-force attempts on sensitive endpoints.

---

## 📄 License & Credits

Developed with precision for **RentalHub**. All proprietary rights reserved.

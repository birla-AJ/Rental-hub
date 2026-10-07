# Going live — step by step

## 0. What you are deploying
One server running three containers: **PostgreSQL**, the **API**, and **Caddy** (serves the web app, forwards `/api` to the API, and gets free HTTPS certificates by itself). The mobile apps talk to `https://YOUR-DOMAIN/api`.
**Run exactly one API container.** It keeps working data in memory and saves every change to the database before answering; two copies would overwrite each other.

## 1. Before you touch the server (these take days — start now)
- [ ] **Domain** and a small Linux server (2 GB RAM is enough to start). Point the domain's DNS **A record** at the server.
- [ ] **SMS (OTP login):** an account with MSG91 (or similar). In India you must register your sender and an OTP template under **DLT**. Without this, no one can log in.
- [ ] **Payments:** a Razorpay account with KYC/activation done (business documents; takes days). Create the **webhook** in the Razorpay dashboard: URL `https://YOUR-DOMAIN/api/webhooks/razorpay`, events `payment.captured`, `payment.failed`, `refund.processed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. Test everything with Razorpay *test mode* keys first (test cards/UPI), then switch to live keys.
- [ ] **WhatsApp (AI verification):** Meta Business verification + a WhatsApp Business number + **approved message templates** for the owner/tenant messages in `apps/api/src/ai.js`. Until then leave the WhatsApp variables empty — the app still works (checkout confirmation in the app), the assistant just won't send anything.
- [ ] **Legal text:** replace the placeholder Help / Privacy / Terms in the mobile app (`src/screens/Static.js`) and have the owner agreement reviewed by a lawyer — it states the 20% commission, the 7-day waiver and that the waiver is not rent compensation.
- [ ] **Client decisions still open:** what a tenant pays at booking; allowed stay lengths; whether rooms may be marketed before owner consent (currently: no); where cashback for the 3rd/4th booking comes from.

## 2. Server setup
```bash
# install Docker + the compose plugin, then:
git clone <your repo> /opt/rentalhub && cd /opt/rentalhub
cp .env.production.example .env.production      # fill every value; JWT_SECRET: openssl rand -base64 48
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml logs -f api      # should print "RentalHub API on :4000 (durable storage)"
curl https://YOUR-DOMAIN/api/health                          # {"ok":true,"storage":"durable",...}
```
The API **refuses to start** in production if something important is missing (JWT secret, storage, SMS provider, WhatsApp secrets) and prints every problem at once. Check without starting: `cd apps/api && npm run check:env`.

## 3. First login to the admin site
A live server starts **empty — no demo data**. Put your own mobile number in `BOOTSTRAP_ADMIN_PHONE` (and your name in `BOOTSTRAP_ADMIN_NAME`) in `.env.production` before the first start; that person becomes the first admin and signs in with an SMS code. (Without it a brand-new database refuses to start.)
Then open `https://YOUR-DOMAIN` → **Staff** → add your agents and any other admins. They sign in on their own phones; nobody can sign up as staff by themselves. **Deactivate** cuts a person off immediately, even if their phone is still logged in. The system won't let you deactivate yourself, the last admin, or an agent who still has open properties (reassign those first).
Never set `SEED_DEMO=1` on a live server.

## 4. Mobile apps
- Set `PROD_URL` in `apps/mobile/src/config.js` to `https://YOUR-DOMAIN/api`.
- Build release versions (Android: `cd android && ./gradlew bundleRelease` after creating a signing key; iOS: archive in Xcode) and submit to Play Store / App Store. Store review needs a privacy policy URL and an explanation of why camera, location and photos are used (the permission texts are already in the app).
- Test on real phones first (the code has not yet been run on a device — expect small fixes).

## 5. WhatsApp webhook (when ready)
In Meta's developer console set the callback URL to `https://YOUR-DOMAIN/api/webhooks/whatsapp` and the verify token to your `WHATSAPP_VERIFY_TOKEN`; subscribe to **messages**.

## 6. Backups — do this on day one
`./scripts/backup.sh` writes a database dump and a copy of the uploaded photos to `./backups` and keeps 14 days. Schedule it with cron (instructions inside the script) and **copy the files off the server**. Then do a **test restore** on another machine — an untested backup is a hope, not a backup.
Restore: `gunzip -c backups/db-XXXX.sql.gz | docker compose -f docker-compose.prod.yml exec -T db psql -U rentalhub rentalhub`.

## 7. Watching it
- Uptime monitor (UptimeRobot, etc.) on `https://YOUR-DOMAIN/api/health`.
- Logs: `docker compose -f docker-compose.prod.yml logs --since 1h api` — one JSON line per request (method, path, status, ms, user id — never tokens, OTPs or request bodies).
- Admin → Settings shows whether storage / WhatsApp / SMS are real or "mock".
- Updating: `git pull && docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` (the API saves its data and exits cleanly on restart).

## 8. Known limits (be honest with the client)
- Single API instance; fine for an Indore pilot, but scaling out needs the relational (Prisma) migration.
- The PostgreSQL storage, MSG91 sender and WhatsApp sender are written but have not been run against the real services yet — do a full dry run in a staging copy first.
- Photos live on the server disk (a Docker volume, included in the backup). Move to S3-style storage when volume grows.

# RentalHub — complete setup guide (from zero to running, then to live)

Three programs make the product: the **API** (the brain, port 4000), the **web app** (admin / agent / owner, port 5173), and the **mobile app** (tenant / agent / owner, React Native CLI, JavaScript).
Commands below are for Mac/Linux terminals. Windows: use PowerShell (differences are shown where they matter).

---------------------------------------------------------------------
## PART 1 — Install the tools (once)

| You need | For | Check it |
|---|---|---|
| **Node.js 22 (LTS)** | everything | `node -v` → v22.x |
| **Git** (optional) | version control | `git --version` |
| **JDK 17** | Android build | `java -version` → 17 |
| **Android Studio** (SDK Platform 35, Build-Tools, an emulator) | Android app | open Android Studio → SDK Manager |
| **Xcode 15+ and CocoaPods/Ruby** (Mac only) | iPhone app | `xcode-select -p`, `ruby -v` |

Node via nvm (Mac/Linux): 
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# open a new terminal, then:
nvm install 22 && nvm use 22 && node -v
```
Windows: install Node 22 LTS from nodejs.org, then JDK 17 (e.g. Temurin) and Android Studio.

Android environment variables (add to ~/.zshrc or ~/.bashrc; on Windows set them in System Environment Variables):
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk        # Linux: $HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
adb version                                           # must print a version
```

---------------------------------------------------------------------
## PART 2 — Run everything on your computer

Unzip the project and open a terminal in the `rentalhub` folder.

### 2.1 Check that everything works (no internet needed)
```bash
npm test          # ~85 automated tests; all should pass
```

### 2.2 Start the API (terminal 1)
```bash
npm run api                       # in-memory demo data; resets when you stop it
# keep data between restarts instead:
SQLITE_PATH=./data/rentalhub.db npm run api                 # Mac/Linux
# Windows PowerShell:  $env:SQLITE_PATH="./data/rentalhub.db"; npm run api
```
You should see `RentalHub API on :4000`. Open http://localhost:4000/health → `{"ok":true,...}`.
In development the SMS code (OTP) is **shown on the login screen** ("Dev mode code") — no SMS provider needed.

### 2.3 Start the web app (terminal 2)
```bash
npm run setup          # installs the web + mobile packages (needs internet, takes a few minutes)
npm run web            # opens at http://localhost:5173
```
Log in with a number from the table below.

### 2.4 Start the mobile app (terminals 3 and 4)
First time only — create the Android/iOS native projects (needs internet):
```bash
cd apps/mobile
npm run native:add
```
Then, with an Android emulator running (Android Studio → Device Manager → ▶) **or** a phone connected by USB with USB-debugging on:
```bash
npm run start          # terminal 3: Metro (the JavaScript bundler) — leave it running
npm run android        # terminal 4: builds and installs the app (first build takes 5–15 minutes)
```
iPhone (Mac only):
```bash
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```
**Where is the API for the app?** `apps/mobile/src/config.js`
- Android emulator → `http://10.0.2.2:4000` (already default)
- iOS simulator → `http://localhost:4000` (already default)
- Real Android phone with USB: `adb reverse tcp:4000 tcp:4000`, then change the Android URL in config.js to `http://localhost:4000`
- Real phone on Wi-Fi: use your computer's address, e.g. `http://192.168.1.20:4000` (find it with `ipconfig` / `ifconfig`), and allow port 4000 in your firewall.
The QR scanner needs a camera — use a **real phone** (emulators have only a fake camera).

### 2.5 Demo logins (development only)
| Role | Name | Mobile |
|---|---|---|
| Tenant | Rahul Verma (lives in a verified room) | 9876543210 |
| Tenant | Neha Sharma (property waiting for verification) | 9876432109 |
| Tenant | Amit Patel | 9765432109 |
| Owner | Suresh Agrawal | 9425011111 |
| Owner | Mahesh Joshi | 9826012345 |
| Agent | Vikram Solanki | 9770012345 |
| Agent | Pooja Mehta | 9770054321 |
| Admin | Platform Admin | 9000000000 |
Enter the number → the code is displayed on the screen → tap Verify. Any **new** number becomes a new tenant (it can also choose "Owner").

### 2.6 Walk through the whole business (15 minutes)
1. **Tenant registers a property** — log in as a new number (e.g. 9111111111) → Register property → fill 6 steps → give an *owner* number that matches a demo owner, e.g. 9826012345.
2. **Admin** (web, 9000000000) → *Properties* → open it → *Assign agent*.
3. **Agent** (mobile, 9770012345) → open the task → schedule visit → KYC, location, **QR tags**, checklist → Submit. The tenant now has a **30% cashback token**.
4. **Owner** (mobile, 9826012345) → consent screens appear → *Accept & activate* → the rooms show under Properties.
5. **Checkout:** tenant → *I'm moving out* → scan the room QR (on a second screen, from Agent → QR Tags) → confirm date → **owner confirms** (Dashboard → Review checkout) → room becomes **Vacant**, cashback becomes **ready**, the **7-day countdown** starts.
6. **Booking:** another tenant → Search → book the vacant room → pay (simulated) → Admin web → *Bookings* → Confirm → Mark moved in → the owner sees **commission 20%** (or *Commission Waived* if it took more than 7 days).

---------------------------------------------------------------------
## PART 3 — Accounts and approvals you need to go live (start these NOW — some take weeks)

| # | What | Why | Typical wait |
|---|---|---|---|
| 1 | **Domain name** (e.g. app.yourbrand.in) | HTTPS address | same day |
| 2 | **A server** (Ubuntu 22/24, 2 GB RAM+, public IP) from any cloud/VPS provider | runs the API, database and website | same day |
| 3 | **SMS provider with DLT** (e.g. MSG91): register your business as sender + an **OTP template** with DLT | login codes — without it nobody can log in | several days – 2 weeks |
| 4 | **Razorpay** account, fully activated (business KYC) | tenant payments + refunds | days |
| 5 | **Meta Business verification + WhatsApp Business API** + approved **message templates** | AI assistant messages to owner/tenant (optional at first — checkout still works in the app) | 1–3+ weeks |
| 6 | **Google Play Developer** account | publish the Android app | days (identity check) |
| 7 | **Apple Developer Program** account | publish the iPhone app | days |
| 8 | **Legal text**: Terms, Privacy Policy (public URL), owner agreement reviewed by a lawyer | store review + trust | your lawyer |
| 9 | Client decisions: what a tenant pays at booking, stay lengths, cashback for the 3rd/4th booking | final business rules | your client |

---------------------------------------------------------------------
## PART 4 — Put the server live

### 4.1 Prepare the server (Ubuntu)
```bash
ssh root@YOUR_SERVER_IP
apt update && apt install -y unzip curl ufw
curl -fsSL https://get.docker.com | sh                  # installs Docker + compose
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
```
Point your domain's **A record** to YOUR_SERVER_IP (at your domain provider) and wait until it resolves (`ping app.yourbrand.in`).

### 4.2 Upload and configure
From your computer:
```bash
scp rentalhub-phase17.zip root@YOUR_SERVER_IP:/opt/
```
On the server:
```bash
cd /opt && unzip rentalhub-phase17.zip && cd rentalhub
cp .env.production.example .env.production
openssl rand -base64 48         # copy the output into JWT_SECRET
openssl rand -base64 24         # copy the output into POSTGRES_PASSWORD
nano .env.production            # fill DOMAIN, secrets, BOOTSTRAP_ADMIN_PHONE (YOUR mobile), MSG91_*, RAZORPAY_*, CORS_ORIGINS=https://app.yourbrand.in
```
Use Razorpay **test-mode keys** first.

### 4.3 Start
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml logs -f api       # wait for: RentalHub API on :4000 (durable storage)   (Ctrl+C to leave)
curl https://app.yourbrand.in/api/health
```
If the API prints `cannot start:` it lists every missing setting — fix `.env.production` and run the `up -d` command again.
Open `https://app.yourbrand.in` → log in with your `BOOTSTRAP_ADMIN_PHONE` (the SMS arrives on your phone) → **Staff** → add your agents.

### 4.4 Connect the gateways
- **Razorpay dashboard → Webhooks → Add:** URL `https://app.yourbrand.in/api/webhooks/razorpay`, secret = your `RAZORPAY_WEBHOOK_SECRET`, events `payment.captured`, `payment.failed`, `refund.processed`. Make a test payment with a test card before switching to live keys.
- **WhatsApp (when Meta approves):** fill `WHATSAPP_*` in `.env.production`, re-run the `up -d` command, and in Meta's console set callback URL `https://app.yourbrand.in/api/webhooks/whatsapp` + your verify token; subscribe to *messages*.

### 4.5 Backups and updates
```bash
chmod +x scripts/backup.sh && ./scripts/backup.sh               # test it once
crontab -e     # add this line (daily 02:00):   0 2 * * * cd /opt/rentalhub && ./scripts/backup.sh >> backup.log 2>&1
```
Copy `./backups` to another place (another server or cloud storage) and **test a restore** (command in DEPLOY.md).
Update to a new version: upload the new zip, unzip over the folder, then run the same `docker compose ... up -d --build` command. Keep `.env.production` safe — never share it.

---------------------------------------------------------------------
## PART 5 — Publish the mobile apps

1. Set the live API address in `apps/mobile/src/config.js`: `PROD_URL = 'https://app.yourbrand.in/api'`.
2. **Android**
```bash
cd apps/mobile/android
keytool -genkeypair -v -storetype PKCS12 -keystore app/rentalhub-release.keystore -alias rentalhub -keyalg RSA -keysize 2048 -validity 10000
```
   **Back this keystore and its passwords up somewhere safe — if you lose it you can never update the app.** Add to `android/gradle.properties`:
```
RENTALHUB_STORE_FILE=rentalhub-release.keystore
RENTALHUB_STORE_PASSWORD=your-password
RENTALHUB_KEY_ALIAS=rentalhub
RENTALHUB_KEY_PASSWORD=your-password
```
   In `android/app/build.gradle` add inside `android { ... }` (and use it in `buildTypes { release { signingConfig signingConfigs.release } }`):
```
signingConfigs { release { storeFile file(RENTALHUB_STORE_FILE); storePassword RENTALHUB_STORE_PASSWORD; keyAlias RENTALHUB_KEY_ALIAS; keyPassword RENTALHUB_KEY_PASSWORD } }
```
```bash
./gradlew bundleRelease          # result: app/build/outputs/bundle/release/app-release.aab → upload in Play Console
```
3. **iPhone (Mac):** `cd apps/mobile/ios && bundle exec pod install`, open `RentalHub.xcworkspace` in Xcode → select your Team → Product → Archive → Distribute to App Store Connect.
4. Both stores ask for a **privacy policy URL** and why the app uses camera, location and photos (QR scan at checkout, pin the property, property and ID photos).

---------------------------------------------------------------------
## PART 6 — If something goes wrong

| Problem | Fix |
|---|---|
| App says "Network request failed" | API not running, or wrong address in `src/config.js` (see 2.4). Android emulator must use `10.0.2.2`. |
| `adb` not found / no devices | Set `ANDROID_HOME` + PATH (Part 1); start an emulator or enable USB debugging; `adb devices` must list it. |
| `npm run native:add` fails | Needs internet; run it again. It only adds the `android/` and `ios/` folders. |
| Android build errors about Java | `java -version` must be 17; set `JAVA_HOME`. |
| iPhone: pod install fails | `cd ios && bundle install && bundle exec pod install --repo-update` |
| Metro port busy | `npx react-native start --port 8082` |
| Camera/QR scan black screen | Use a real phone; allow Camera permission in phone Settings. |
| Login code not arriving (live) | SMS template/DLT not approved, wrong `MSG91_*`, or number limit (5/hour per number) — check `docker compose ... logs api`. |
| "cannot start: …" on the server | The message lists the missing settings in `.env.production`. |
| Anything else | Send me the exact error text (and which command you ran). |

---------------------------------------------------------------------
## PART 7 — What is still not done
1. **Not yet run on a real phone/emulator** — the mobile app is code-complete but untested on a device; expect small first-run fixes.
2. **Not yet tried against the real services:** PostgreSQL, MSG91, Razorpay, WhatsApp, Docker/Caddy.
3. Push notifications (notifications show inside the app only), Hindi language, app icons/polish, map view.
4. Prisma/relational migration (needed only when you outgrow one server).
5. Error monitoring (e.g. Sentry), automated phone tests, an external security review.

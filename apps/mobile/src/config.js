import { Platform } from 'react-native';

// Where the RentalHub API runs.
//  - Android emulator: 10.0.2.2 is your computer.  - iOS simulator: localhost.
//  - Real Android phone over USB: run `adb reverse tcp:4000 tcp:4000` and set the Android value to 'http://localhost:4000'.
//  - Real phone on Wi-Fi: use your computer's LAN IP, e.g. 'http://192.168.1.20:4000'.
const DEV_URL = Platform.select({ android: 'http://10.0.2.2:4000', default: 'http://localhost:4000' });
const PROD_URL = 'https://app.your-domain.in/api';   // TODO: your real domain + /api (see DEPLOY.md). Must be https for release builds.

export const API_URL = __DEV__ ? DEV_URL : PROD_URL;

// Push notifications are OFF until you set up Firebase and run `npm run push:enable` (it switches this on). See SETUP.md, Part 7.
export const PUSH_ENABLED = false;

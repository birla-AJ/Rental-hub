import { Platform } from 'react-native';

// Where the RentalHub API runs.
//  - Android emulator: 10.0.2.2 is your computer.  - iOS simulator: localhost.
//  - Real Android phone over USB: run `adb reverse tcp:4000 tcp:4000` and set the Android value to 'http://localhost:4000'.
//  - Real phone on Wi-Fi: use your computer's LAN IP, e.g. 'http://192.168.1.20:4000'.
const DEV_URL = Platform.select({ android: 'http://10.0.2.2:4000', default: 'http://localhost:4000' });
const PROD_URL = 'http://51.20.116.181/api';   // EC2 Public Server (or set your custom domain if mapped)

export const API_URL = __DEV__ ? DEV_URL : PROD_URL;

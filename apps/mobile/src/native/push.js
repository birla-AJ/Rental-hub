import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { PUSH_ENABLED } from '../config';
import { api } from '../api';

// Firebase is OPTIONAL: it is only installed by `npm run push:enable`. Without it this whole file does nothing, and the app works as before.
let messaging = null;
try { messaging = require('@react-native-firebase/messaging').default; } catch { messaging = null; }

let currentToken = null, unsubscribers = [], onOpen = () => {};
export const setNotificationOpenHandler = (fn) => { onOpen = fn; };   // App.js: open the Notifications screen

const post = (path, body) => api(path, { method: 'POST', body }).catch((e) => console.warn('[push]', path, e.message));

/** Ask permission, give the server this phone's address, and listen for messages. Never throws — a push problem must not stop the app. */
export async function registerPush() {
  if (!PUSH_ENABLED || !messaging) return;
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) { const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS'); if (r !== PermissionsAndroid.RESULTS.GRANTED) return; }
    if (Platform.OS === 'ios') { const st = await messaging().requestPermission(); if (st !== messaging.AuthorizationStatus.AUTHORIZED && st !== messaging.AuthorizationStatus.PROVISIONAL) return; }
    currentToken = await messaging().getToken(); await post('/devices', { token: currentToken, platform: Platform.OS });
    unsubscribers.forEach((u) => u()); unsubscribers = [
      messaging().onTokenRefresh((t) => { currentToken = t; post('/devices', { token: t, platform: Platform.OS }); }),
      messaging().onMessage(async (m) => { if (m.notification) Alert.alert(m.notification.title ?? 'RentalHub', m.notification.body ?? '', [{ text: 'Later', style: 'cancel' }, { text: 'Open', onPress: () => onOpen() }]); }),   // app is open: show it ourselves
      messaging().onNotificationOpenedApp(() => onOpen()),                                                                                                                                                   // tapped while in the background
    ];
    const first = await messaging().getInitialNotification(); if (first) onOpen();                                                                                                                         // tapped while the app was closed
  } catch (e) { console.warn('[push] setup failed:', e?.message); }
}

/** Log out: this phone stops receiving this person's notifications. Call BEFORE the login token is cleared. */
export async function unregisterPush() {
  unsubscribers.forEach((u) => u()); unsubscribers = [];
  if (!PUSH_ENABLED || !messaging || !currentToken) return;
  await post('/devices/remove', { token: currentToken }); currentToken = null;
}

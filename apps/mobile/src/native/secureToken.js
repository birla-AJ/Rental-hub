import * as Keychain from 'react-native-keychain';

// The login token lives in the iOS Keychain / Android Keystore, so people stay logged in and nothing sensitive sits in plain storage.
const SERVICE = 'rentalhub.token';
export async function saveToken(token) { try { await Keychain.setGenericPassword('rentalhub', token, { service: SERVICE }); } catch (e) { console.warn('[auth] could not store token', e?.message); } }
export async function loadToken() { try { const c = await Keychain.getGenericPassword({ service: SERVICE }); return c ? c.password : null; } catch { return null; } }
export async function clearToken() { try { await Keychain.resetGenericPassword({ service: SERVICE }); } catch {} }

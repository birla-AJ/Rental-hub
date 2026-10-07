import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

Geolocation.setRNConfiguration({ skipPermissionRequests: true, authorizationLevel: 'whenInUse' });   // we ask explicitly below

async function ensurePermission() {
  if (Platform.OS === 'android') {
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, { title: 'Location', message: 'RentalHub uses your location to find homes near you and to pin a property.', buttonPositive: 'Allow' });
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  return new Promise((resolve) => Geolocation.requestAuthorization(() => resolve(true), () => resolve(false)));
}

/** -> { lat, lng, accuracy } or throws an Error with a human message. */
export async function getPosition() {
  if (!(await ensurePermission())) throw new Error('Allow location to continue');
  return new Promise((resolve, reject) => Geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy ?? 0) }),
    () => reject(new Error('Could not get your location. Turn on GPS and try again.')),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
}

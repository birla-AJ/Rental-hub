import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

const MAX_VIDEO = 25 * 1024 * 1024;

/** -> [{ uri, base64, type }] (empty if cancelled). Photos are resized/compressed to keep uploads small. */
export async function pickPhotos(limit) {
  const r = await launchImageLibrary({ mediaType: 'photo', selectionLimit: limit, includeBase64: true, quality: 0.6, maxWidth: 1600, maxHeight: 1600 });
  if (r.didCancel) return [];
  if (r.errorCode) throw new Error(r.errorMessage ?? 'Could not open your photos');
  return (r.assets ?? []).filter((a) => a.base64).map((a) => ({ uri: a.uri, base64: a.base64, type: a.type ?? 'image/jpeg' }));
}

/** -> { uri, type } or null. Throws if the clip is over 25 MB. */
export async function pickVideo() {
  const r = await launchImageLibrary({ mediaType: 'video', selectionLimit: 1, videoQuality: 'medium' });
  if (r.didCancel) return null;
  if (r.errorCode) throw new Error(r.errorMessage ?? 'Could not open your videos');
  const a = r.assets?.[0]; if (!a) return null;
  if (a.fileSize && a.fileSize > MAX_VIDEO) throw new Error('Video must be under 25 MB. Try a shorter clip.');
  return { uri: a.uri, type: a.type ?? 'video/mp4' };
}

/** Reads a local file as base64 (used for videos, which the picker does not return as base64). */
export async function readBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onerror = () => reject(new Error('Could not read the file')); fr.onload = () => resolve(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
}

/** One photo for the ID: from the camera or the gallery. -> { uri, base64, type } or null if cancelled. */
export async function pickIdPhoto(fromCamera) {
  const opts = { mediaType: 'photo', selectionLimit: 1, includeBase64: true, quality: 0.8, maxWidth: 2000, maxHeight: 2000 };
  const r = fromCamera ? await launchCamera({ ...opts, cameraType: 'back' }) : await launchImageLibrary(opts);
  if (r.didCancel) return null;
  if (r.errorCode) throw new Error(r.errorMessage ?? 'Could not open the camera');
  const a = r.assets?.[0]; return a?.base64 ? { uri: a.uri, base64: a.base64, type: a.type ?? 'image/jpeg' } : null;
}

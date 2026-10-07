import { tealFresh, radius, space, statusColor } from './shared/tokens';
import { Dimensions } from 'react-native';
export const t = tealFresh;
export { radius, space };
export const statusTone = statusColor(tealFresh);
export const cardShadow = { shadowColor: '#14281C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 };
// Keep hierarchy compact on small phones and avoid oversized text on larger displays.
const width = Dimensions.get('window').width;
const typeScale = Math.max(0.9, Math.min(1, width / 390));
export const textSize = (size) => Math.round(size * typeScale);
export const font = { h1: textSize(24), h2: textSize(18), h3: textSize(15), body: textSize(13), small: textSize(11) };

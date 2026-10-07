import React from 'react';
import Svg, { Path, Rect, Circle, Line, Polyline } from 'react-native-svg';

const common = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
export default function Icon({ name = 'home', size = 22, color = '#315B43', strokeWidth = 1.8 }) {
  const p = { stroke: color, strokeWidth, ...common };
  const items = {
    home: <><Path {...p} d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><Path {...p} d="M9 21v-6h6v6"/></>,
    search: <><Circle {...p} cx="11" cy="11" r="7"/><Path {...p} d="m20 20-4-4"/></>,
    calendar: <><Rect {...p} x="3" y="5" width="18" height="16" rx="2"/><Path {...p} d="M16 3v4M8 3v4M3 10h18"/></>,
    wallet: <><Path {...p} d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><Path {...p} d="M4 8h16v5h-4a2 2 0 1 0 0 4h4"/></>,
    user: <><Circle {...p} cx="12" cy="8" r="4"/><Path {...p} d="M4 21a8 8 0 0 1 16 0"/></>,
    dashboard: <><Rect {...p} x="3" y="3" width="7" height="7" rx="1"/><Rect {...p} x="14" y="3" width="7" height="7" rx="1"/><Rect {...p} x="3" y="14" width="7" height="7" rx="1"/><Rect {...p} x="14" y="14" width="7" height="7" rx="1"/></>,
    building: <><Rect {...p} x="4" y="3" width="16" height="18" rx="2"/><Path {...p} d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01M10 21v-5h4v5"/></>,
    clock: <><Circle {...p} cx="12" cy="12" r="9"/><Path {...p} d="M12 7v5l3 2"/></>,
    handshake: <><Path {...p} d="m8 12 3 3a2 2 0 0 0 3 0l2-2M2 9l4-4 5 5M22 9l-4-4-5 5M4 11l4 4M7 15l2 2M17 11l-2 2"/></>,
    tag: <><Path {...p} d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><Circle {...p} cx="8" cy="8" r="1"/></>,
    history: <><Path {...p} d="M3 12a9 9 0 1 0 3-6.7L3 8"/><Path {...p} d="M3 3v5h5M12 7v5l3 2"/></>,
    bed: <><Path {...p} d="M3 19v-7h18v7M3 16h18M6 12V8a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v4M3 19v2M21 19v2"/></>,
    key: <><Circle {...p} cx="8" cy="15" r="4"/><Path {...p} d="m11 12 9-9M15 6l3 3M17 4l3 3"/></>,
    'chevron-left': <Polyline {...p} points="15 18 9 12 15 6" />,
    'chevron-right': <Polyline {...p} points="9 18 15 12 9 6" />,
    bell: <><Path {...p} d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><Path {...p} d="M10 21h4"/></>,
    'map-pin': <><Path {...p} d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><Circle {...p} cx="12" cy="10" r="2.5"/></>,
    'id-card': <><Rect {...p} x="3" y="4" width="18" height="16" rx="2"/><Circle {...p} cx="8" cy="10" r="2"/><Path {...p} d="M5 17c.8-2 5.2-2 6 0M14 9h4M14 13h4M14 17h2"/></>,
    'credit-card': <><Rect {...p} x="3" y="5" width="18" height="14" rx="2"/><Path {...p} d="M3 10h18M7 15h2"/></>,
    heart: <Path {...p} d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
    help: <><Circle {...p} cx="12" cy="12" r="9"/><Path {...p} d="M9.5 9a2.7 2.7 0 1 1 4.6 1.9c-1.4 1.2-2.1 1.7-2.1 3.1M12 17h.01"/></>,
    lock: <><Rect {...p} x="4" y="10" width="16" height="11" rx="2"/><Path {...p} d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/></>,
    file: <><Path {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><Path {...p} d="M14 2v6h6M8 13h8M8 17h6"/></>,
    check: <Path {...p} d="m5 12 4 4L19 6"/>,
    alert: <><Path {...p} d="M10.3 3.7 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><Path {...p} d="M12 9v4M12 17h.01"/></>,
    gift: <><Rect {...p} x="3" y="8" width="18" height="13" rx="1"/><Path {...p} d="M12 8v13M3 12h18M12 8H8.5a2.5 2.5 0 1 1 2.5-2.5V8Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5V8Z"/></>,
    'door-open': <><Path {...p} d="M5 21V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v17"/><Path {...p} d="M5 21h14M15 12h.01"/></>,
    location: <><Path {...p} d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><Circle {...p} cx="12" cy="10" r="2.5"/></>,
    party: <><Path {...p} d="m4 20 8-8M6 6l12 12M14 3l1 3M20 9l-3 1M4 12l3 1M12 20l1-3"/><Path {...p} d="m3 3 6 2-4 4z"/></>,
    logout: <><Path {...p} d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><Path {...p} d="m14 8 4 4-4 4M8 12h10"/></>,
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24">{items[name] ?? items.home}</Svg>;
}

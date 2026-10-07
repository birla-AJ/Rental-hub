import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

/**
 * RentalHub's own brand mark: a welcoming roof, a protected doorway,
 * and a small location point that represents verified homes.
 */
export default function BrandLogo({ size = 48, color = '#FFFFFF', accent = '#A9D6B5' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Path d="M10 29.5 32 11l22 18.5" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 27.5V49a5 5 0 0 0 5 5h20a5 5 0 0 0 5-5V27.5" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M27 54V40a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v14" stroke={color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="48.5" cy="16" r="5.5" fill={accent} stroke={color} strokeWidth="2.5" />
    </Svg>
  );
}

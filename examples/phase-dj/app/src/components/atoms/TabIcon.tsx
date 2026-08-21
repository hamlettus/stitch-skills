import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export type TabIconName = 'crate' | 'wheel' | 'studio' | 'feed' | 'you';

export interface TabIconProps {
  readonly name: TabIconName;
  readonly color: string;
  readonly size?: number;
}

export const TabIcon: React.FC<TabIconProps> = ({ name, color, size = 23 }) => {
  const stroke = color;
  const sw = 1.9;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'crate' ? (
        <Path d="M4 6h16M4 12h16M4 18h10" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
      ) : null}
      {name === 'wheel' ? (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={stroke} strokeWidth={sw} />
          <Circle cx={12} cy={12} r={3} stroke={stroke} strokeWidth={sw} />
        </>
      ) : null}
      {name === 'studio' ? (
        <>
          <Path d="M6 4v16M12 4v16M18 4v16" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <Circle cx={6} cy={9} r={2.2} fill={stroke} />
          <Circle cx={12} cy={15} r={2.2} fill={stroke} />
          <Circle cx={18} cy={7} r={2.2} fill={stroke} />
        </>
      ) : null}
      {name === 'feed' ? (
        <Path d="M4 5h16v11H8l-4 4z" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      ) : null}
      {name === 'you' ? (
        <>
          <Circle cx={12} cy={8} r={4} stroke={stroke} strokeWidth={sw} />
          <Path d="M4.5 20a7.5 7.5 0 0115 0" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </>
      ) : null}
    </Svg>
  );
};

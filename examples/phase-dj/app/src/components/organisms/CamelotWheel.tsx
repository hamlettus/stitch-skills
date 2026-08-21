import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/theme';
import { compatibleKeys, keyCode, keyColor, keyName, Letter } from '@/utils/camelot';

const SIZE = 300;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RINGS: { letter: Letter; r1: number; r2: number }[] = [
  { letter: 'B', r1: 106, r2: 140 },
  { letter: 'A', r1: 70, r2: 106 },
];

function polar(r: number, angleDeg: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function sectorPath(r1: number, r2: number, a0: number, a1: number): string {
  const [x1, y1] = polar(r2, a0);
  const [x2, y2] = polar(r2, a1);
  const [x3, y3] = polar(r1, a1);
  const [x4, y4] = polar(r1, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${x1} ${y1}A${r2} ${r2} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 ${large} 0 ${x4} ${y4}Z`;
}

export interface CamelotWheelProps {
  readonly selectedKey: string;
  readonly onSelect: (code: string) => void;
}

export const CamelotWheel: React.FC<CamelotWheelProps> = ({ selectedKey, onSelect }) => {
  const compatible = new Set(compatibleKeys(selectedKey));

  return (
    <View style={styles.stage}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {Array.from({ length: 12 }).map((_, i) => {
          const num = i + 1;
          const a0 = -90 + i * 30 - 15;
          const a1 = -90 + i * 30 + 15;
          const mid = (a0 + a1) / 2;
          return (
            <G key={num}>
              {RINGS.map((ring) => {
                const code = keyCode(num, ring.letter);
                const selected = code === selectedKey;
                const compat = compatible.has(code);
                const opacity = selected || compat ? 1 : 0.16;
                const [tx, ty] = polar((ring.r1 + ring.r2) / 2, mid);
                return (
                  <G key={code} onPress={() => onSelect(code)}>
                    <Path
                      d={sectorPath(ring.r1, ring.r2, a0, a1)}
                      fill={keyColor(code)}
                      fillOpacity={opacity}
                      stroke={selected ? colors.text : colors.bg}
                      strokeWidth={selected ? 2.5 : 1}
                    />
                    <SvgText
                      x={tx}
                      y={ty + 4}
                      fontSize={selected ? 13 : 12}
                      fontFamily={fonts.monoBold}
                      fill={colors.onAccent}
                      fillOpacity={opacity}
                      textAnchor="middle"
                    >
                      {code}
                    </SvgText>
                  </G>
                );
              })}
            </G>
          );
        })}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.centerKey}>{selectedKey}</Text>
        <Text style={styles.centerName}>{keyName(selectedKey)}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: { width: SIZE, height: SIZE, alignSelf: 'center', marginVertical: 6 },
  center: {
    position: 'absolute',
    top: CY - 59,
    left: CX - 59,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: colors.bg2,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerKey: { fontFamily: fonts.display, fontSize: 34, color: colors.key },
  centerName: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.muted,
    marginTop: 5,
  },
});

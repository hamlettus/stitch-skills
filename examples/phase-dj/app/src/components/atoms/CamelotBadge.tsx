import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { keyColor, keyName } from '@/utils/camelot';

export interface CamelotBadgeProps {
  readonly code: string;
  readonly size?: number;
  readonly showName?: boolean;
}

export const CamelotBadge: React.FC<CamelotBadgeProps> = ({ code, size = 44, showName = true }) => {
  return (
    <View
      style={[styles.badge, { width: size, height: size, backgroundColor: keyColor(code) }]}
      accessibilityLabel={`Key ${code}, ${keyName(code)}`}
    >
      <Text style={[styles.code, { fontSize: size * 0.3 }]}>{code}</Text>
      {showName ? <Text style={styles.name}>{keyName(code)}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontFamily: fonts.monoBold,
    color: colors.onAccent,
  },
  name: {
    position: 'absolute',
    bottom: 3,
    right: 5,
    fontSize: 7,
    fontFamily: fonts.mono,
    color: colors.onAccent,
    opacity: 0.65,
  },
});

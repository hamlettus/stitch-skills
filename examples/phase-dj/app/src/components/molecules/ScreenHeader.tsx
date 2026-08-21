import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, fonts, radius, type } from '@/theme';

export interface ScreenHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly rightGlyph?: string;
  readonly rightColor?: string;
  readonly onRightPress?: () => void;
  readonly rightLabel?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  eyebrow,
  title,
  rightGlyph,
  rightColor,
  onRightPress,
  rightLabel,
}) => {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {rightGlyph ? (
        <Pressable
          style={styles.iconBtn}
          onPress={onRightPress}
          accessibilityRole="button"
          accessibilityLabel={rightLabel ?? 'Action'}
        >
          <Text style={[styles.glyph, rightColor ? { color: rightColor } : null]}>{rightGlyph}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 18,
    paddingHorizontal: 2,
  },
  textCol: { flexShrink: 1 },
  eyebrow: {
    fontFamily: fonts.mono,
    fontSize: type.eyebrow,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    color: colors.muted2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: type.h1,
    lineHeight: type.h1,
    color: colors.text,
    marginTop: 5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontSize: 17,
    color: colors.text,
  },
});

import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { keyColor, keyName, keyCode } from '@/utils/camelot';

export interface KeyPickerModalProps {
  readonly visible: boolean;
  readonly selected: string | null;
  readonly onSelect: (code: string) => void;
  readonly onClose: () => void;
  readonly deckLabel: string;
}

const NUMS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Full-screen modal presenting all 24 Camelot keys as a tappable grid.
 * Each row: the number plus A (minor) and B (major) cells.
 */
export const KeyPickerModal: React.FC<KeyPickerModalProps> = ({
  visible,
  selected,
  onSelect,
  onClose,
  deckLabel,
}) => {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{deckLabel}</Text>
          <Text style={styles.title}>Set Key</Text>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {/* Column labels */}
          <View style={styles.colLabels}>
            <View style={styles.numCol} />
            <Text style={[styles.colLabel, { flex: 1 }]}>A · minor</Text>
            <Text style={[styles.colLabel, { flex: 1 }]}>B · major</Text>
          </View>

          {NUMS.map((num) => {
            const codeA = keyCode(num, 'A');
            const codeB = keyCode(num, 'B');
            const selA = selected === codeA;
            const selB = selected === codeB;
            return (
              <View key={num} style={styles.row}>
                {/* Number label */}
                <View style={styles.numCol}>
                  <Text style={styles.numLabel}>{num}</Text>
                </View>

                {/* A cell */}
                <Pressable
                  style={[styles.keyCell, selA && { borderColor: keyColor(codeA), borderWidth: 2 }]}
                  onPress={() => { onSelect(codeA); onClose(); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${codeA} — ${keyName(codeA)}`}
                  accessibilityState={{ selected: selA }}
                >
                  <View style={[styles.keyDot, { backgroundColor: keyColor(codeA) }]} />
                  <View style={styles.keyText}>
                    <Text style={styles.keyCode}>{codeA}</Text>
                    <Text style={styles.keyMusicalName}>{keyName(codeA)}</Text>
                  </View>
                </Pressable>

                {/* B cell */}
                <Pressable
                  style={[styles.keyCell, selB && { borderColor: keyColor(codeB), borderWidth: 2 }]}
                  onPress={() => { onSelect(codeB); onClose(); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${codeB} — ${keyName(codeB)}`}
                  accessibilityState={{ selected: selB }}
                >
                  <View style={[styles.keyDot, { backgroundColor: keyColor(codeB) }]} />
                  <View style={styles.keyText}>
                    <Text style={styles.keyCode}>{codeB}</Text>
                    <Text style={styles.keyMusicalName}>{keyName(codeB)}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        {/* Clear button */}
        {selected != null && (
          <View style={styles.footer}>
            <Pressable
              style={styles.clearBtn}
              onPress={() => { onSelect(''); onClose(); }}
              accessibilityRole="button"
              accessibilityLabel="Clear key"
            >
              <Text style={styles.clearBtnText}>CLEAR KEY</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 10,
  },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted, letterSpacing: 0.8 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.text, flex: 1 },
  closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontFamily: fonts.mono, fontSize: 16, color: colors.muted },
  grid: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  colLabels: { flexDirection: 'row', marginBottom: 6, alignItems: 'center' },
  numCol: { width: 32 },
  colLabel: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted2, letterSpacing: 0.8, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  numLabel: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.muted2, textAlign: 'center' },
  keyCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  keyText: { flex: 1 },
  keyCode: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.text },
  keyMusicalName: { fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginTop: 1 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  clearBtnText: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.muted, letterSpacing: 1 },
});

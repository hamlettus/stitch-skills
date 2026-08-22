import React, { useEffect } from 'react';
import { View, Text, Pressable, Modal, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from '@/theme';
import { useMusicLibrary } from '@/hooks/useMusicLibrary';
import { LibraryTrack } from '@/types';

export interface LibraryPickerModalProps {
  readonly visible: boolean;
  readonly deckLabel: string;
  readonly onSelect: (track: LibraryTrack) => void;
  readonly onClose: () => void;
  /** Fallback to the system document picker for files outside the library. */
  readonly onBrowseFiles: () => void;
}

const formatDur = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const LibraryPickerModal: React.FC<LibraryPickerModalProps> = ({
  visible,
  deckLabel,
  onSelect,
  onClose,
  onBrowseFiles,
}) => {
  const lib = useMusicLibrary();

  useEffect(() => {
    if (visible) void lib.open();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{deckLabel}</Text>
          <Text style={styles.title}>Your Music</Text>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {lib.permission === 'denied' ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>Library access denied</Text>
            <Text style={styles.stateBody}>
              Enable music access for PHASE in your device Settings, or browse for a file instead.
            </Text>
          </View>
        ) : lib.loading && lib.tracks.length === 0 ? (
          <View style={styles.state}>
            <ActivityIndicator color={colors.key} />
            <Text style={styles.stateBody}>Reading your library…</Text>
          </View>
        ) : lib.tracks.length === 0 ? (
          <View style={styles.state}>
            <Text style={styles.stateTitle}>No audio found</Text>
            <Text style={styles.stateBody}>
              Streaming-only tracks (Apple Music, Spotify) are DRM-protected and can't be read by apps.
              Use downloaded or purchased files.
            </Text>
          </View>
        ) : (
          <FlatList
            data={lib.tracks as LibraryTrack[]}
            keyExtractor={(t) => t.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onEndReached={() => void lib.loadMore()}
            onEndReachedThreshold={0.6}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => { onSelect(item); onClose(); }}
                accessibilityRole="button"
                accessibilityLabel={`Load ${item.name}`}
              >
                <Text style={styles.rowGlyph}>♫</Text>
                <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.rowDur}>{formatDur(item.durationMs)}</Text>
              </Pressable>
            )}
            ListFooterComponent={
              lib.loading && lib.tracks.length > 0 ? (
                <ActivityIndicator color={colors.muted2} style={styles.footerSpinner} />
              ) : null
            }
          />
        )}

        <View style={styles.footer}>
          <Pressable
            style={styles.filesBtn}
            onPress={() => { onClose(); onBrowseFiles(); }}
            accessibilityRole="button"
            accessibilityLabel="Browse files instead"
          >
            <Text style={styles.filesBtnText}>BROWSE FILES INSTEAD</Text>
          </Pressable>
        </View>
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

  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 10 },
  stateTitle: { fontFamily: fonts.displaySemi, fontSize: 16, color: colors.text },
  stateBody: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted, textAlign: 'center', lineHeight: 18 },

  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  rowGlyph: { fontSize: 14, color: colors.muted2 },
  rowName: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text },
  rowDur: { fontFamily: fonts.mono, fontSize: 11, color: colors.muted2 },
  footerSpinner: { marginVertical: 16 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  filesBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filesBtnText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.key, letterSpacing: 1 },
});

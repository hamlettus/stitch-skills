import { useCallback, useState } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { LibraryTrack } from '@/types';

export type LibraryPermission = 'granted' | 'denied' | 'undetermined';

export interface MusicLibraryState {
  readonly tracks: readonly LibraryTrack[];
  readonly loading: boolean;
  readonly permission: LibraryPermission;
  readonly hasMore: boolean;
  /** Request permission and load the first page. */
  readonly open: () => Promise<void>;
  /** Load the next page of assets. */
  readonly loadMore: () => Promise<void>;
}

const PAGE_SIZE = 60;

/**
 * Reads audio assets from the device's media library. On iOS this surfaces
 * files in the app-visible media store; DRM-protected Apple Music tracks are
 * not exposed by the OS and will not appear.
 */
export function useMusicLibrary(): MusicLibraryState {
  const [tracks, setTracks] = useState<readonly LibraryTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<LibraryPermission>('undetermined');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const toTrack = (a: MediaLibrary.Asset): LibraryTrack => ({
    id: a.id,
    uri: a.uri,
    name: (a.filename ?? 'Unknown').replace(/\.[^.]+$/, ''),
    durationMs: Math.round((a.duration ?? 0) * 1000),
  });

  const open = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await MediaLibrary.requestPermissionsAsync();
      setPermission(perm.granted ? 'granted' : perm.canAskAgain ? 'undetermined' : 'denied');
      if (!perm.granted) {
        setTracks([]);
        return;
      }

      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        mediaType: MediaLibrary.MediaType.audio,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setTracks(page.assets.map(toTrack));
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after: cursor,
        mediaType: MediaLibrary.MediaType.audio,
        sortBy: MediaLibrary.SortBy.creationTime,
      });
      setTracks((prev) => [...prev, ...page.assets.map(toTrack)]);
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } finally {
      setLoading(false);
    }
  }, [cursor, hasMore, loading]);

  return { tracks, loading, permission, hasMore, open, loadMore };
}

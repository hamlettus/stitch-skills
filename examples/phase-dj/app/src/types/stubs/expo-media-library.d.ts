/**
 * Minimal type stub for expo-media-library (~16.0.5).
 * The real types are installed with: npm install
 */
declare module 'expo-media-library' {
  export interface Asset {
    id: string;
    filename: string;
    uri: string;
    mediaType: string;
    duration: number;
    creationTime: number;
  }

  export interface PagedInfo<T> {
    assets: T[];
    endCursor: string;
    hasNextPage: boolean;
    totalCount: number;
  }

  export interface PermissionResponse {
    status: 'granted' | 'denied' | 'undetermined';
    granted: boolean;
    canAskAgain: boolean;
  }

  export interface AssetsOptions {
    first?: number;
    after?: string;
    mediaType?: string | string[];
    sortBy?: string | string[];
  }

  export const MediaType: {
    audio: string;
    photo: string;
    video: string;
    unknown: string;
  };

  export const SortBy: {
    creationTime: string;
    modificationTime: string;
    default: string;
  };

  export function requestPermissionsAsync(writeOnly?: boolean): Promise<PermissionResponse>;
  export function getPermissionsAsync(writeOnly?: boolean): Promise<PermissionResponse>;
  export function getAssetsAsync(options?: AssetsOptions): Promise<PagedInfo<Asset>>;
  export function getAssetInfoAsync(asset: Asset | string): Promise<Asset & { localUri?: string }>;
}

/**
 * Minimal type stubs for packages resolved at build time.
 * The real types are installed with: npm install
 */
declare module 'expo-modules-core' {
  export function requireOptionalNativeModule<T>(name: string): T | null;
  export function requireNativeModule<T>(name: string): T;
}

declare module 'expo-asset' {
  export class Asset {
    static fromModule(module: number | string): Asset;
    uri: string;
    localUri: string | null;
    downloadAsync(): Promise<Asset>;
  }
}

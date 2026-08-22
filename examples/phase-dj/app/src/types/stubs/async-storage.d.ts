/**
 * Minimal type stub for @react-native-async-storage/async-storage (1.23.1).
 * The real types are installed with: npm install
 */
declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
  };
  export default AsyncStorage;
}

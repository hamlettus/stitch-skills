/**
 * Minimal type stub for expo-document-picker (~11.0.1).
 * The real types are installed with: npm install
 */
declare module 'expo-document-picker' {
  export interface DocumentPickerAsset {
    uri: string;
    name: string | null;
    size?: number | null;
    mimeType?: string | null;
  }

  export interface DocumentPickerResult {
    canceled: boolean;
    assets: DocumentPickerAsset[] | null;
  }

  export interface DocumentPickerOptions {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }

  export function getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult>;
}

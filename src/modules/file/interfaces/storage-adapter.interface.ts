export interface UploadOptions {
  contentType?: string;
  acl?: 'public-read' | 'private';
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  etag?: string;
}

export interface UrlOptions {
  expiresIn?: number;
  publicRead?: boolean;
}

export interface IStorageAdapter {
  upload(file: Buffer, key: string, options?: UploadOptions): Promise<UploadResult>;
  getUrl(key: string, options?: UrlOptions): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

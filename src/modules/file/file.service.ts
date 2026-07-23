import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { IStorageAdapter } from './interfaces/storage-adapter.interface';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { StoreContext } from '../../common/context/store-context';
import type { UploadedFileInfo } from './uploaded-file.interface';

@Injectable()
export class FileService {
  private readonly storageAdapter: IStorageAdapter;

  constructor() {
    // Use LocalStorageAdapter for development; switch to OSS adapter in production
    this.storageAdapter = new LocalStorageAdapter();
  }

  async uploadFile(file: UploadedFileInfo, type: string): Promise<{ url: string; key: string }> {
    const storeId = StoreContext.getStoreId() ?? 0;
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const ext = this.getExtension(file.originalname);
    const uuid = uuidv4();

    const key = `wraplab/${storeId}/${type}/${date}/${uuid}.${ext}`;

    const result = await this.storageAdapter.upload(file.buffer, key, {
      contentType: file.mimetype,
      acl: type === 'models' ? 'public-read' : 'private',
    });

    return { url: result.url, key: result.key };
  }

  async deleteFile(key: string): Promise<void> {
    await this.storageAdapter.delete(key);
  }

  private getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : 'bin';
  }
}

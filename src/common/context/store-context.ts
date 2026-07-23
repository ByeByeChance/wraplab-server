import { AsyncLocalStorage } from 'async_hooks';

interface StoreContextData {
  storeId: number | null;
  staffId: number;
  role: 'admin' | 'manager' | 'staff';
  requestId: string;
}

export class StoreContext {
  private static storage = new AsyncLocalStorage<StoreContextData>();

  static run<T>(data: StoreContextData, fn: () => T): T {
    return this.storage.run(data, fn);
  }

  static getStoreId(): number | null {
    return this.storage.getStore()?.storeId ?? null;
  }

  static getStaffId(): number {
    return this.storage.getStore()?.staffId ?? 0;
  }

  static getRole(): string {
    return this.storage.getStore()?.role ?? 'staff';
  }

  static getRequestId(): string {
    return this.storage.getStore()?.requestId ?? '';
  }

  static isAdmin(): boolean {
    return this.storage.getStore()?.role === 'admin';
  }
}

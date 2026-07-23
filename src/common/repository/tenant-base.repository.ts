import { Repository, ObjectLiteral, FindManyOptions, FindOneOptions, DeepPartial, SaveOptions } from 'typeorm';
import { StoreContext } from '../context/store-context';

export class TenantBaseRepository<T extends ObjectLiteral> extends Repository<T> {
  /**
   * Multi-tenant condition: only applies when StoreContext has a store_id and the role is not admin.
   */
  private get tenantCondition(): Record<string, unknown> | null {
    const storeId = StoreContext.getStoreId();
    if (StoreContext.isAdmin() && storeId === null) {
      return null;
    }
    if (storeId !== null) {
      return { store_id: storeId };
    }
    return null;
  }

  override async find(options?: FindManyOptions<T>): Promise<T[]> {
    return super.find(this.mergeTenantFindMany(options));
  }

  override async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return super.findOne(this.mergeTenantFindOne(options));
  }

  override async findAndCount(options?: FindManyOptions<T>): Promise<[T[], number]> {
    return super.findAndCount(this.mergeTenantFindMany(options));
  }

  override async count(options?: FindManyOptions<T>): Promise<number> {
    return super.count(this.mergeTenantFindMany(options));
  }

  override create(): T;
  override create(entityLikeArray: DeepPartial<T>[]): T[];
  override create(entityLike: DeepPartial<T>): T;
  override create(entityLike?: DeepPartial<T> | DeepPartial<T>[]): T | T[] {
    const result = super.create(entityLike as DeepPartial<T>[]);
    const storeId = StoreContext.getStoreId();
    if (storeId !== null) {
      if (Array.isArray(result)) {
        for (const entity of result) {
          const record = entity as Record<string, unknown>;
          if (record.store_id === undefined) {
            record.store_id = storeId;
          }
        }
      } else if (result !== undefined) {
        const record = result as Record<string, unknown>;
        if (record.store_id === undefined) {
          record.store_id = storeId;
        }
      }
    }
    return result;
  }

  override async save<T2 extends DeepPartial<T>>(entity: T2, options?: SaveOptions): Promise<T2 & T>;
  override async save<T2 extends DeepPartial<T>>(
    entities: T2[],
    options: SaveOptions & { reload: false },
  ): Promise<T2[]>;
  override async save<T2 extends DeepPartial<T>>(entities: T2[], options?: SaveOptions): Promise<(T2 & T)[]>;
  override async save<T2 extends DeepPartial<T>>(
    entityOrEntities: T2 | T2[],
    options?: SaveOptions,
  ): Promise<(T2 & T) | (T2 & T)[]> {
    const storeId = StoreContext.getStoreId();
    if (storeId !== null) {
      if (Array.isArray(entityOrEntities)) {
        for (const entity of entityOrEntities) {
          const record = entity as Record<string, unknown>;
          if (!record.store_id) {
            record.store_id = storeId;
          }
        }
      } else {
        const record = entityOrEntities as Record<string, unknown>;
        if (!record.store_id) {
          record.store_id = storeId;
        }
      }
    }
    return super.save(entityOrEntities as T2 & T, options) as Promise<(T2 & T) | (T2 & T)[]>;
  }

  private mergeTenantFindMany(options?: FindManyOptions<T>): FindManyOptions<T> | undefined {
    const cond = this.tenantCondition;
    if (!cond) return options;
    if (!options) return { where: cond } as FindManyOptions<T>;
    return {
      ...options,
      where: {
        ...((options.where as Record<string, unknown>) || {}),
        ...cond,
      },
    } as FindManyOptions<T>;
  }

  private mergeTenantFindOne(options: FindOneOptions<T>): FindOneOptions<T> {
    const cond = this.tenantCondition;
    if (!cond) return options;
    return {
      ...options,
      where: {
        ...((options.where as Record<string, unknown>) || {}),
        ...cond,
      },
    } as FindOneOptions<T>;
  }
}

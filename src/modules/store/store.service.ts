import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Store } from './entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { UpdateStoreDto, CreateStoreDto } from './dto/store.dto';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async getMyStore(): Promise<Store> {
    const storeId = StoreContext.getStoreId();
    if (!storeId) {
      throw new BusinessException(ErrorCode.FORBIDDEN, 'Forbidden');
    }
    const store = await this.storeRepo.findOne({ where: { id: storeId, deleted_at: IsNull() } });
    if (!store) {
      throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, '门店不存在');
    }
    return store;
  }

  async updateMyStore(dto: UpdateStoreDto): Promise<Store> {
    const store = await this.getMyStore();
    await this.storeRepo.update(store.id, dto);
    return this.storeRepo.findOneByOrFail({ id: store.id });
  }

  // Admin: CRUD for all stores
  async findAll(): Promise<Store[]> {
    return this.storeRepo.find({ where: { deleted_at: IsNull() }, order: { name: 'ASC' } });
  }

  async createStore(dto: CreateStoreDto): Promise<Store> {
    const store = this.storeRepo.create(dto);
    return this.storeRepo.save(store);
  }

  async updateStore(id: number, dto: UpdateStoreDto): Promise<Store> {
    await this.storeRepo.update(id, dto);
    return this.storeRepo.findOneByOrFail({ id });
  }

  async deleteStore(id: number): Promise<void> {
    await this.storeRepo.update(id, { deleted_at: new Date() } as Partial<Store>);
  }
}

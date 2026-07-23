import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ServiceTypeConfig } from './entities/service-type-config.entity';
import { StoreServiceConfig } from './entities/store-service-config.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { UpdateStoreServiceConfigDto, StoreServiceConfigResponseDto } from './dto/store-service-config.dto';

@Injectable()
export class TimeSlotCapacityService {
  private readonly SLOT_UNIT_MINUTES = 30;
  private readonly TOTAL_SLOTS_PER_DAY = 18; // 9 hours / 30 min = 18 slots

  constructor(
    @InjectRepository(ServiceTypeConfig)
    private readonly serviceTypeConfigRepo: Repository<ServiceTypeConfig>,
    @InjectRepository(StoreServiceConfig)
    private readonly storeServiceConfigRepo: Repository<StoreServiceConfig>,
  ) {}

  async getCapacity(
    slotDurationMinutes: number,
    serviceType: string,
    storeId: number,
  ): Promise<{ capacity: number; booked: number; available: number }> {
    // Get service duration (prefer store custom, fallback to global)
    let serviceDuration: number;

    const storeConfig = await this.storeServiceConfigRepo.findOne({
      where: { store_id: storeId, service_type: serviceType, deleted_at: IsNull() },
    });

    if (storeConfig) {
      serviceDuration = storeConfig.duration_minutes;
    } else {
      const globalConfig = await this.serviceTypeConfigRepo.findOne({
        where: { service_type: serviceType, deleted_at: IsNull() },
      });
      if (!globalConfig) {
        throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, `服务类型 ${serviceType} 未配置`);
      }
      serviceDuration = globalConfig.duration_minutes;
    }

    // Calculate capacity using slot units
    const serviceSlots = Math.ceil(serviceDuration / this.SLOT_UNIT_MINUTES);
    const totalSlotUnits = Math.floor(slotDurationMinutes / this.SLOT_UNIT_MINUTES);
    const capacity = Math.floor(totalSlotUnits / serviceSlots);

    return {
      capacity,
      booked: 0, // Populated by caller who has access to appointment data
      available: capacity,
    };
  }

  async getStoreServiceConfig(storeId: number): Promise<StoreServiceConfigResponseDto[]> {
    const globalConfigs = await this.serviceTypeConfigRepo.find({
      where: { deleted_at: IsNull() },
    });

    const storeConfigs = await this.storeServiceConfigRepo.find({
      where: { store_id: storeId, deleted_at: IsNull() },
    });

    const storeConfigMap = new Map(storeConfigs.map((c) => [c.service_type, c]));

    return globalConfigs.map((gc) => {
      const sc = storeConfigMap.get(gc.service_type);
      if (sc) {
        return {
          service_type: sc.service_type,
          duration_minutes: sc.duration_minutes,
          label: gc.label,
          source: 'custom' as const,
        };
      }
      return {
        service_type: gc.service_type,
        duration_minutes: gc.duration_minutes,
        label: gc.label,
        source: 'global' as const,
      };
    });
  }

  async updateStoreServiceConfig(storeId: number, dto: UpdateStoreServiceConfigDto): Promise<void> {
    // Validate store exists
    // In production, injected StoreRepo to check

    await this.storeServiceConfigRepo.manager.transaction(async (manager) => {
      for (const item of dto.services) {
        const existing = await manager.findOne(StoreServiceConfig, {
          where: {
            store_id: storeId,
            service_type: item.service_type,
            deleted_at: IsNull(),
          },
        });

        if (existing) {
          await manager.update(StoreServiceConfig, existing.id, {
            duration_minutes: item.duration_minutes,
          } as Partial<StoreServiceConfig>);
        } else {
          await manager.save(
            StoreServiceConfig,
            manager.create(StoreServiceConfig, {
              store_id: storeId,
              service_type: item.service_type,
              duration_minutes: item.duration_minutes,
            }),
          );
        }
      }
    });
  }
}

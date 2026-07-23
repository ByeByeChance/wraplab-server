import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Case } from '../case/entities/case.entity';
import { Store } from '../store/entities/store.entity';
import { BusinessException } from '../../common/exceptions/business.exception';
import { ErrorCode } from '../../common/exceptions/error-codes';
import { StoreContext } from '../../common/context/store-context';
import { ShareDto } from './dto/share.dto';

export interface ShareCardData {
  case_id: number;
  title: string;
  cover_image_url: string | null;
  summary: string;
  wxa_code_url: string;
  store_name: string;
  store_logo: string | null;
}

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    @InjectRepository(Case)
    private readonly caseRepo: Repository<Case>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
  ) {}

  async getShareCardData(caseId: number): Promise<ShareCardData> {
    const staffId = StoreContext.getStaffId();

    const caseEntity = await this.caseRepo.findOne({
      where: { id: caseId, deleted_at: IsNull() },
      relations: [
        'configuration',
        'configuration.model',
        'configuration.model.series',
        'configuration.model.series.brand',
      ],
    });

    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    // Get store info
    const store = await this.storeRepo.findOne({
      where: { id: caseEntity.store_id },
    });

    const storeName = store?.name ?? 'WrapLab';
    const storeLogo = store?.logo ?? null;

    // Build summary
    const brandName = caseEntity.configuration?.model?.series?.brand?.name ?? '';
    const modelName = caseEntity.configuration?.model?.name ?? '';
    const summary = [brandName, modelName, caseEntity.title].filter(Boolean).join(' | ');

    // TODO: Replace hardcoded OSS URL with actual WeChat WXA code API integration.
    // The real implementation should call WeChat's `wxacode.getUnlimited` API
    // (https://developers.weixin.qq.com/miniprogram/dev/api-backend/open-api/qr-code/wxacode.getUnlimited.html)
    // with the scene parameter set to `case_${caseId}`, then upload the returned
    // image buffer to OSS and return the resulting URL. A stale-while-revalidate
    // cache (e.g. Redis with 7-day TTL) should be used to avoid regenerating on
    // every share request.
    const wxaCodeUrl = `https://oss.wraplab.com/wxacode/case_${caseId}_sid_${staffId}.png`;

    return {
      case_id: caseEntity.id,
      title: caseEntity.title,
      cover_image_url: caseEntity.cover_image_url,
      summary,
      wxa_code_url: wxaCodeUrl,
      store_name: storeName,
      store_logo: storeLogo,
    };
  }

  async recordShare(caseId: number, dto: ShareDto): Promise<{ share_count: number }> {
    const caseEntity = await this.caseRepo.findOne({
      where: { id: caseId, deleted_at: IsNull() },
    });

    if (!caseEntity) {
      throw new BusinessException(ErrorCode.CASE_NOT_FOUND, '案例不存在');
    }

    this.logger.log(`Share recorded: case=${caseId} platform=${dto.platform} staff=${StoreContext.getStaffId()}`);

    // Atomic increment share_count
    await this.caseRepo.increment({ id: caseId }, 'share_count', 1);

    // Re-fetch to get updated count
    const updated = await this.caseRepo.findOne({
      where: { id: caseId },
      select: ['id', 'share_count'],
    });

    return { share_count: updated?.share_count ?? 0 };
  }
}

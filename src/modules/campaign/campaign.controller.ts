import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CampaignService } from './campaign.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ApplyCampaignDto,
  ApproveCampaignDto,
  ScheduleCampaignDto,
} from './dto/campaign.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller()
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  // Admin — create campaign
  @Post('admin/campaigns')
  @Roles('manager', 'admin')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCampaignDto) {
    return this.campaignService.create(dto);
  }

  // Admin — list campaigns
  @Get('admin/campaigns')
  @Roles('manager', 'admin')
  async findAll(@Query() pagination: PaginationDto) {
    return this.campaignService.findAll(pagination);
  }

  // Admin — update campaign
  @Put('admin/campaigns/:id')
  @Roles('manager', 'admin')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCampaignDto) {
    return this.campaignService.update(id, dto);
  }

  // Admin — delete campaign
  @Delete('admin/campaigns/:id')
  @Roles('manager', 'admin')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.campaignService.delete(id);
    return null;
  }

  // Public — available campaigns (IP rate-limited)
  @Public()
  @Get('campaigns/available')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async findAvailable() {
    return this.campaignService.findAvailable();
  }

  // Campaign apply — handled by CampaignModule
  @Post('quotes/:id/apply-campaign')
  @HttpCode(HttpStatus.OK)
  async applyCampaign(@Param('id', ParseIntPipe) quoteId: number, @Body() dto: ApplyCampaignDto) {
    return this.campaignService.applyCampaign(quoteId, dto.campaign_id);
  }

  // --- Approval ---

  // Admin — get pending approvals
  @Get('admin/campaigns/approvals')
  @Roles('admin')
  async findApprovals(@Query() pagination: PaginationDto, @Query('status') status?: string) {
    return this.campaignService.findApprovals(pagination, status);
  }

  // Admin — approve/reject campaign
  @Put('admin/campaigns/:id/approve')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async approveCampaign(@Param('id', ParseIntPipe) id: number, @Body() dto: ApproveCampaignDto) {
    if (dto.action === 'approve') {
      return this.campaignService.approve(id);
    } else {
      return this.campaignService.reject(id, dto.reject_reason ?? '');
    }
  }

  // Admin — schedule campaign
  @Put('admin/campaigns/:id/schedule')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async schedule(@Param('id', ParseIntPipe) id: number, @Body() dto: ScheduleCampaignDto) {
    return this.campaignService.schedule(id, new Date(dto.scheduledAt));
  }

  // Manager+ — my campaigns
  @Get('admin/campaigns/my')
  @Roles('manager', 'admin')
  async findMyCampaigns(@Query() pagination: PaginationDto, @Query('approvalStatus') approvalStatus?: string) {
    return this.campaignService.findMyCampaigns(pagination, approvalStatus);
  }

  // Manager+ — submit for approval
  @Post('admin/campaigns/:id/submit-approval')
  @Roles('manager', 'admin')
  @HttpCode(HttpStatus.OK)
  async submitForApproval(@Param('id', ParseIntPipe) id: number) {
    return this.campaignService.submitForApproval(id);
  }
}

import { Controller, Get, Post, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { CaseTagService } from './case-tag.service';
import { CreateTagDto } from '../admin/dto/create-tag.dto';
import { SetCaseTagsDto } from '../admin/dto/set-case-tags.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller()
export class TagController {
  constructor(private readonly caseTagService: CaseTagService) {}

  @Public()
  @Get('tags')
  async getPublicTags(@Query('store_id') storeId?: string) {
    return this.caseTagService.getPublicTags(storeId ? parseInt(storeId, 10) : undefined);
  }

  @Get('admin/tags')
  @Roles('admin')
  async getAdminTags(@Query('store_id') storeId?: string, @Query('keyword') keyword?: string) {
    return this.caseTagService.getAdminTags(storeId ? parseInt(storeId, 10) : undefined, keyword);
  }

  @Post('admin/tags')
  @Roles('admin')
  async create(@Body() dto: CreateTagDto) {
    return this.caseTagService.create(dto);
  }

  @Put('admin/tags/:id')
  @Roles('admin')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateTagDto) {
    return this.caseTagService.update(id, dto);
  }

  @Delete('admin/tags/:id')
  @Roles('admin')
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.caseTagService.delete(id);
    return { success: true };
  }

  @Put('admin/cases/:id/tags')
  @Roles('admin', 'manager')
  async setCaseTags(@Param('id', ParseIntPipe) caseId: number, @Body() dto: SetCaseTagsDto) {
    await this.caseTagService.setCaseTags(caseId, dto);
    return { success: true, tags: dto.tag_ids };
  }
}

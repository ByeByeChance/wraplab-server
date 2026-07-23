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
  Headers,
} from '@nestjs/common';
import { CaseService } from './case.service';
import { CreateCaseDto, UpdateCaseDto } from './dto/create-case.dto';
import { QueryCaseDto } from './dto/query-case.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('cases')
export class CaseController {
  constructor(private readonly caseService: CaseService) {}

  @Public()
  @Get()
  async findAll(@Query() query: QueryCaseDto) {
    return this.caseService.findAll(query);
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.caseService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCaseDto) {
    return this.caseService.create(dto);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCaseDto) {
    return this.caseService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.caseService.delete(id);
    return null;
  }

  @Public()
  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  async like(@Param('id', ParseIntPipe) id: number, @Headers('x-anonymous-id') anonymousId?: string) {
    return this.caseService.like(id, anonymousId);
  }
}

import { Controller, Post, Get, Delete, Body, Param, Query, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('quotes')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateQuoteDto) {
    return this.quoteService.create(dto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return this.quoteService.findAll(pagination);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.quoteService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.quoteService.delete(id);
    return null;
  }
}

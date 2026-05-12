import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SuggestQueryDto, SuggestResponseDto } from './dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Поиск компаний и услуг',
    description:
      'Единый поиск: возвращает компании с точками и услугами. ' +
      'Мультиязычный (укр/рус/eng). Матчит по названию услуги, компании, категории, типу. ' +
      'Поддержка гео-фильтра, рейтинга, цены, сортировки.',
  })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['organization'],
    description:
      'Optional grouping. "organization" returns one row per unique organization. ' +
      'Absent (default) returns one row per (org, branch).',
  })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('suggest')
  @ApiOperation({
    summary: 'Phase 7 typed-sections autocomplete',
    description:
      'Возвращает { query, intent, sections: { categories, businesses, services }, took, cached }. ' +
      'Категории — из JSON seed (22 multilingual). Businesses/services — Postgres ILIKE. ' +
      'q ≥ 2 chars (DTO @MinLength). lat/lon опциональны для distanceKm.',
  })
  @ApiResponse({ status: 200, type: SuggestResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Validation error (e.g. q < 2 chars)',
  })
  suggest(@Query() query: SuggestQueryDto): Promise<SuggestResponseDto> {
    return this.searchService.suggest(query);
  }
}

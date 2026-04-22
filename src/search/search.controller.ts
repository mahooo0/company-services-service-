import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SuggestQueryDto } from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('services')
  @ApiOperation({
    summary: 'Поиск услуг по точкам с фильтрами, гео и сортировкой',
    description:
      'Каждый результат = услуга + конкретная точка (филиал) где она доступна. ' +
      'Если у компании 3 точки и услуга доступна в 2 из них — вернётся 2 результата.',
  })
  searchServices(@Query() query: SearchQueryDto) {
    return this.searchService.searchServices(query);
  }

  @Get('branches')
  @ApiOperation({
    summary: 'Поиск точек (филиалов) с фильтрами, гео и сортировкой',
    description:
      'Каждый результат = точка (филиал) организации с количеством доступных услуг.',
  })
  searchBranches(@Query() query: SearchQueryDto) {
    return this.searchService.searchBranches(query);
  }

  @Get('suggest')
  @ApiOperation({
    summary: 'Автокомплит по услугам и компаниям',
  })
  suggest(@Query() query: SuggestQueryDto) {
    return this.searchService.suggest(query);
  }
}

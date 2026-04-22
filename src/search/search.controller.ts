import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SuggestQueryDto } from './dto';

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
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Get('suggest')
  @ApiOperation({
    summary: 'Автокомплит по услугам, компаниям и категориям',
    description:
      'Мультиязычные подсказки при вводе. Возвращает услуги, категории и компании.',
  })
  suggest(@Query() query: SuggestQueryDto) {
    return this.searchService.suggest(query);
  }
}

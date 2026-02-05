import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ServiceCategoriesService } from './service-categories.service';
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
  ServiceCategoryResponseDto,
  ServiceCategoryWithTypesResponseDto,
} from './dto';

@ApiTags('Service Categories')
@ApiBearerAuth()
@Controller('service-categories')
export class ServiceCategoriesController {
  constructor(
    private readonly serviceCategoriesService: ServiceCategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Получить все категории' })
  @ApiResponse({
    status: 200,
    description: 'Список категорий',
    type: [ServiceCategoryResponseDto],
  })
  async findAll() {
    return this.serviceCategoriesService.findAll();
  }

  @Get('with-types')
  @ApiOperation({ summary: 'Получить все категории с типами' })
  @ApiResponse({
    status: 200,
    description: 'Список категорий с типами услуг',
    type: [ServiceCategoryWithTypesResponseDto],
  })
  async findAllWithTypes() {
    return this.serviceCategoriesService.findAllWithTypes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить категорию по ID' })
  @ApiParam({ name: 'id', description: 'ID категории' })
  @ApiResponse({
    status: 200,
    description: 'Категория с типами',
    type: ServiceCategoryWithTypesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceCategoriesService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Получить категорию по slug' })
  @ApiParam({ name: 'slug', description: 'Slug категории' })
  @ApiResponse({
    status: 200,
    description: 'Категория с типами',
    type: ServiceCategoryWithTypesResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  async findBySlug(@Param('slug') slug: string) {
    return this.serviceCategoriesService.findBySlug(slug);
  }

  @Post()
  @ApiOperation({ summary: 'Создать категорию (админ)' })
  @ApiResponse({
    status: 201,
    description: 'Категория создана',
    type: ServiceCategoryResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Категория уже существует' })
  async create(@Body() dto: CreateServiceCategoryDto) {
    return this.serviceCategoriesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить категорию (админ)' })
  @ApiParam({ name: 'id', description: 'ID категории' })
  @ApiResponse({
    status: 200,
    description: 'Категория обновлена',
    type: ServiceCategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  @ApiResponse({ status: 409, description: 'Категория/slug уже существует' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.serviceCategoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить категорию (админ)' })
  @ApiParam({ name: 'id', description: 'ID категории' })
  @ApiResponse({ status: 204, description: 'Категория удалена' })
  @ApiResponse({ status: 404, description: 'Категория не найдена' })
  @ApiResponse({
    status: 409,
    description: 'Невозможно удалить: есть связанные типы',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceCategoriesService.remove(id);
  }
}

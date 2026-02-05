import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { ServicesService } from './services.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  ServiceFiltersDto,
  ServiceResponseDto,
} from './dto';

@ApiTags('Services')
@ApiBearerAuth()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список услуг с фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список услуг с пагинацией',
  })
  async findAll(@Query() filters: ServiceFiltersDto) {
    return this.servicesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить услугу по ID' })
  @ApiParam({ name: 'id', description: 'ID услуги' })
  @ApiResponse({
    status: 200,
    description: 'Данные услуги',
    type: ServiceResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Услуга не найдена' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать услугу' })
  @ApiResponse({
    status: 201,
    description: 'Услуга создана',
    type: ServiceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @ApiResponse({ status: 404, description: 'Тип услуги не найден' })
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить услугу' })
  @ApiParam({ name: 'id', description: 'ID услуги' })
  @ApiResponse({
    status: 200,
    description: 'Услуга обновлена',
    type: ServiceResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @ApiResponse({ status: 404, description: 'Услуга не найдена' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить услугу' })
  @ApiParam({ name: 'id', description: 'ID услуги' })
  @ApiResponse({ status: 204, description: 'Услуга удалена' })
  @ApiResponse({ status: 404, description: 'Услуга не найдена' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.remove(id);
  }
}

// Дополнительный контроллер для получения услуг по организации
@ApiTags('Organization Services')
@ApiBearerAuth()
@Controller('organizations/:organizationId/services')
export class OrganizationServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить услуги организации' })
  @ApiParam({ name: 'organizationId', description: 'ID организации' })
  @ApiResponse({
    status: 200,
    description: 'Список услуг организации',
  })
  async findByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() filters: ServiceFiltersDto,
  ) {
    return this.servicesService.findByOrganization(organizationId, filters);
  }
}

// Дополнительный контроллер для получения услуг по филиалу
@ApiTags('Branch Services')
@ApiBearerAuth()
@Controller('branches/:branchId/services')
export class BranchServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить услуги филиала' })
  @ApiParam({ name: 'branchId', description: 'ID филиала' })
  @ApiResponse({
    status: 200,
    description: 'Список услуг филиала',
  })
  async findByBranch(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() filters: ServiceFiltersDto,
  ) {
    return this.servicesService.findByBranch(branchId, filters);
  }
}

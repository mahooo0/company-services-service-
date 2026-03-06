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
  ApiQuery,
} from '@nestjs/swagger';
import { SpecialistsService } from './specialists.service';
import {
  CreateSpecialistDto,
  UpdateSpecialistDto,
  SpecialistFiltersDto,
  SpecialistResponseDto,
  AssignServiceDto,
  AssignLocationDto,
} from './dto';

@ApiTags('Specialists')
@ApiBearerAuth()
@Controller('specialists')
export class SpecialistsController {
  constructor(private readonly specialistsService: SpecialistsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить список специалистов с фильтрацией' })
  @ApiResponse({
    status: 200,
    description: 'Список специалистов с пагинацией',
  })
  async findAll(@Query() filters: SpecialistFiltersDto) {
    return this.specialistsService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить специалиста по ID' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiResponse({
    status: 200,
    description: 'Данные специалиста',
    type: SpecialistResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Специалист не найден' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.specialistsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать специалиста' })
  @ApiResponse({
    status: 201,
    description: 'Специалист создан',
    type: SpecialistResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  async create(@Body() dto: CreateSpecialistDto) {
    return this.specialistsService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить специалиста' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiResponse({
    status: 200,
    description: 'Специалист обновлен',
    type: SpecialistResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @ApiResponse({ status: 404, description: 'Специалист не найден' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialistDto,
  ) {
    return this.specialistsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить специалиста' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiResponse({ status: 204, description: 'Специалист удален' })
  @ApiResponse({ status: 404, description: 'Специалист не найден' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.specialistsService.remove(id);
  }

  @Post(':id/services')
  @ApiOperation({ summary: 'Назначить услугу специалисту' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiResponse({ status: 201, description: 'Услуга назначена' })
  @ApiResponse({ status: 400, description: 'Услуга уже назначена' })
  @ApiResponse({ status: 404, description: 'Специалист или услуга не найдены' })
  async assignService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignServiceDto,
  ) {
    return this.specialistsService.assignService(id, dto);
  }

  @Delete(':id/services/:serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Убрать услугу у специалиста' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiParam({ name: 'serviceId', description: 'ID услуги' })
  @ApiResponse({ status: 204, description: 'Услуга убрана' })
  @ApiResponse({ status: 404, description: 'Связь не найдена' })
  async unassignService(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.specialistsService.unassignService(id, serviceId);
  }

  @Post(':id/locations')
  @ApiOperation({ summary: 'Назначить локацию специалисту' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiResponse({ status: 201, description: 'Локация назначена' })
  @ApiResponse({ status: 400, description: 'Локация уже назначена' })
  @ApiResponse({ status: 404, description: 'Специалист не найден' })
  async assignLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignLocationDto,
  ) {
    return this.specialistsService.assignLocation(id, dto);
  }

  @Delete(':id/locations/:locationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Убрать локацию у специалиста' })
  @ApiParam({ name: 'id', description: 'ID специалиста' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiResponse({ status: 204, description: 'Локация убрана' })
  @ApiResponse({ status: 404, description: 'Связь не найдена' })
  async unassignLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.specialistsService.unassignLocation(id, locationId);
  }
}

// Дополнительный контроллер для получения специалистов по организации
@ApiTags('Organization Specialists')
@ApiBearerAuth()
@Controller('organizations/:organizationId/specialists')
export class OrganizationSpecialistsController {
  constructor(private readonly specialistsService: SpecialistsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить специалистов организации' })
  @ApiParam({ name: 'organizationId', description: 'ID организации' })
  @ApiResponse({
    status: 200,
    description: 'Список специалистов организации',
  })
  async findByOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() filters: SpecialistFiltersDto,
  ) {
    return this.specialistsService.findByOrganization(organizationId, filters);
  }
}

// Дополнительный контроллер для получения специалистов по локации
@ApiTags('Location Specialists')
@ApiBearerAuth()
@Controller('locations/:locationId/specialists')
export class LocationSpecialistsController {
  constructor(private readonly specialistsService: SpecialistsService) {}

  @Get()
  @ApiOperation({ summary: 'Получить специалистов локации' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiQuery({
    name: 'organizationId',
    description: 'ID организации',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Список специалистов локации',
  })
  async findByLocation(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.specialistsService.findByLocation(locationId, organizationId);
  }
}

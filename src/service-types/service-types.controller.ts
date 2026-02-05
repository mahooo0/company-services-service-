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
import { ServiceTypesService } from './service-types.service';
import {
  CreateServiceTypeDto,
  UpdateServiceTypeDto,
  ServiceTypeResponseDto,
} from './dto';

@ApiTags('Service Types')
@ApiBearerAuth()
@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Get()
  @ApiOperation({ summary: 'Получить все активные типы услуг' })
  @ApiResponse({
    status: 200,
    description: 'Список активных типов услуг',
    type: [ServiceTypeResponseDto],
  })
  async findAllActive() {
    return this.serviceTypesService.findAllActive();
  }

  @Get('all')
  @ApiOperation({ summary: 'Получить все типы услуг (админ)' })
  @ApiResponse({
    status: 200,
    description: 'Список всех типов услуг',
    type: [ServiceTypeResponseDto],
  })
  async findAll() {
    return this.serviceTypesService.findAll();
  }

  @Get('pending')
  @ApiOperation({ summary: 'Получить предложенные типы услуг (админ)' })
  @ApiResponse({
    status: 200,
    description: 'Список предложенных типов услуг',
    type: [ServiceTypeResponseDto],
  })
  async findPending() {
    return this.serviceTypesService.findPending();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить тип услуги по ID' })
  @ApiParam({ name: 'id', description: 'ID типа услуги' })
  @ApiResponse({
    status: 200,
    description: 'Тип услуги',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Тип услуги не найден' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceTypesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Создать тип услуги (админ)' })
  @ApiResponse({
    status: 201,
    description: 'Тип услуги создан',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Тип услуги уже существует' })
  async create(@Body() dto: CreateServiceTypeDto) {
    return this.serviceTypesService.create(dto);
  }

  @Post('suggest')
  @ApiOperation({ summary: 'Предложить новый тип услуги' })
  @ApiResponse({
    status: 201,
    description: 'Тип услуги предложен',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Тип услуги уже существует' })
  async suggest(@Body() dto: CreateServiceTypeDto) {
    // TODO: получить userId из токена
    return this.serviceTypesService.suggest(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить тип услуги (админ)' })
  @ApiParam({ name: 'id', description: 'ID типа услуги' })
  @ApiResponse({
    status: 200,
    description: 'Тип услуги обновлен',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Тип услуги не найден' })
  @ApiResponse({ status: 409, description: 'Тип услуги с таким названием уже существует' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceTypeDto,
  ) {
    return this.serviceTypesService.update(id, dto);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Принять предложенный тип услуги (админ)' })
  @ApiParam({ name: 'id', description: 'ID типа услуги' })
  @ApiResponse({
    status: 200,
    description: 'Тип услуги принят',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Тип услуги не найден' })
  @ApiResponse({ status: 409, description: 'Тип не находится на рассмотрении' })
  async approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceTypesService.approve(id);
  }

  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отклонить предложенный тип услуги (админ)' })
  @ApiParam({ name: 'id', description: 'ID типа услуги' })
  @ApiResponse({
    status: 200,
    description: 'Тип услуги отклонен',
    type: ServiceTypeResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Тип услуги не найден' })
  @ApiResponse({ status: 409, description: 'Тип не находится на рассмотрении' })
  async reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceTypesService.reject(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить тип услуги (админ)' })
  @ApiParam({ name: 'id', description: 'ID типа услуги' })
  @ApiResponse({ status: 204, description: 'Тип услуги удален' })
  @ApiResponse({ status: 404, description: 'Тип услуги не найден' })
  @ApiResponse({ status: 409, description: 'Невозможно удалить: есть связанные услуги' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceTypesService.remove(id);
  }
}

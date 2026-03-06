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
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
  BulkUpdateScheduleDto,
  ScheduleResponseDto,
} from './dto';

@ApiTags('Schedules')
@ApiBearerAuth()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get('specialist/:specialistId/location/:locationId')
  @ApiOperation({ summary: 'Получить расписание специалиста в локации' })
  @ApiParam({ name: 'specialistId', description: 'ID специалиста' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiResponse({
    status: 200,
    description: 'Расписание специалиста на неделю',
    type: [ScheduleResponseDto],
  })
  async findBySpecialistAndLocation(
    @Param('specialistId', ParseUUIDPipe) specialistId: string,
    @Param('locationId', ParseUUIDPipe) locationId: string,
  ) {
    return this.schedulesService.findBySpecialistAndLocation(
      specialistId,
      locationId,
    );
  }

  @Get('location/:locationId')
  @ApiOperation({
    summary: 'Получить все расписания для локации',
  })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiQuery({ name: 'organizationId', description: 'ID организации' })
  @ApiResponse({
    status: 200,
    description: 'Расписания локации, сгруппированные по специалистам',
  })
  async findByLocation(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.schedulesService.findByLocation(locationId, organizationId);
  }

  @Post()
  @ApiOperation({ summary: 'Создать/обновить расписание на один день' })
  @ApiResponse({
    status: 201,
    description: 'Расписание создано/обновлено',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  async create(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Массовое обновление расписания' })
  @ApiResponse({
    status: 201,
    description: 'Расписание обновлено',
    type: [ScheduleResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  async bulkUpdate(@Body() dto: BulkUpdateScheduleDto) {
    return this.schedulesService.bulkUpdate(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Обновить расписание по ID' })
  @ApiParam({ name: 'id', description: 'ID расписания' })
  @ApiResponse({
    status: 200,
    description: 'Расписание обновлено',
    type: ScheduleResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @ApiResponse({ status: 404, description: 'Расписание не найдено' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить расписание' })
  @ApiParam({ name: 'id', description: 'ID расписания' })
  @ApiResponse({ status: 204, description: 'Расписание удалено' })
  @ApiResponse({ status: 404, description: 'Расписание не найдено' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.remove(id);
  }
}

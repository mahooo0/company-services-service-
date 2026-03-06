import {
  Controller,
  Get,
  Post,
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
import { LocationsService } from './locations.service';
import { AssignServiceToLocationDto } from './dto';

@ApiTags('Locations')
@ApiBearerAuth()
@Controller('locations/:locationId')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('services')
  @ApiOperation({ summary: 'Получить услуги локации' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiQuery({ name: 'organizationId', description: 'ID организации' })
  @ApiResponse({
    status: 200,
    description: 'Список услуг локации',
  })
  async findServicesByLocation(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.locationsService.findServicesByLocation(
      locationId,
      organizationId,
    );
  }

  @Post('services')
  @ApiOperation({ summary: 'Привязать услугу к локации' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiResponse({
    status: 201,
    description: 'Услуга привязана к локации',
  })
  @ApiResponse({ status: 404, description: 'Услуга не найдена' })
  @ApiResponse({
    status: 409,
    description: 'Услуга уже привязана к этой локации',
  })
  async assignService(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Body() dto: AssignServiceToLocationDto,
  ) {
    return this.locationsService.assignService(locationId, dto);
  }

  @Delete('services/:serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отвязать услугу от локации' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiParam({ name: 'serviceId', description: 'ID услуги' })
  @ApiResponse({ status: 204, description: 'Услуга отвязана от локации' })
  @ApiResponse({ status: 404, description: 'Связь не найдена' })
  async unassignService(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.locationsService.unassignService(locationId, serviceId);
  }

  @Get('specialists')
  @ApiOperation({ summary: 'Получить специалистов локации' })
  @ApiParam({ name: 'locationId', description: 'ID локации' })
  @ApiQuery({ name: 'organizationId', description: 'ID организации' })
  @ApiResponse({
    status: 200,
    description: 'Список специалистов локации',
  })
  async findSpecialistsByLocation(
    @Param('locationId', ParseUUIDPipe) locationId: string,
    @Query('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.locationsService.findSpecialistsByLocation(
      locationId,
      organizationId,
    );
  }
}

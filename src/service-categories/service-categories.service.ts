import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '@/log/log.service';
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from './dto';

@Injectable()
export class ServiceCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LogService,
  ) {}

  // Получить все категории
  async findAll() {
    return this.prisma.serviceCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Получить все категории с типами
  async findAllWithTypes() {
    return this.prisma.serviceCategory.findMany({
      include: {
        types: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Получить категорию по ID
  async findOne(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        types: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Категория с ID ${id} не найдена`);
    }

    return category;
  }

  // Получить категорию по slug
  async findBySlug(slug: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { slug },
      include: {
        types: {
          where: { status: 'ACTIVE' },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Категория со slug "${slug}" не найдена`);
    }

    return category;
  }

  // Создать категорию (админ)
  async create(dto: CreateServiceCategoryDto) {
    // Проверяем уникальность name и slug
    const existingByName = await this.prisma.serviceCategory.findUnique({
      where: { name: dto.name },
    });

    if (existingByName) {
      throw new ConflictException(`Категория "${dto.name}" уже существует`);
    }

    const existingBySlug = await this.prisma.serviceCategory.findUnique({
      where: { slug: dto.slug },
    });

    if (existingBySlug) {
      throw new ConflictException(`Slug "${dto.slug}" уже используется`);
    }

    const category = await this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
      },
    });

    this.logger.log(`Создана категория: ${category.name}`);
    return category;
  }

  // Обновить категорию (админ)
  async update(id: string, dto: UpdateServiceCategoryDto) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Категория с ID ${id} не найдена`);
    }

    // Проверяем уникальность name
    if (dto.name) {
      const existingByName = await this.prisma.serviceCategory.findFirst({
        where: {
          name: dto.name,
          NOT: { id },
        },
      });

      if (existingByName) {
        throw new ConflictException(`Категория "${dto.name}" уже существует`);
      }
    }

    // Проверяем уникальность slug
    if (dto.slug) {
      const existingBySlug = await this.prisma.serviceCategory.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });

      if (existingBySlug) {
        throw new ConflictException(`Slug "${dto.slug}" уже используется`);
      }
    }

    const category = await this.prisma.serviceCategory.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Обновлена категория: ${category.name}`);
    return category;
  }

  // Удалить категорию (админ)
  async remove(id: string) {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Категория с ID ${id} не найдена`);
    }

    // Проверяем, есть ли типы в этой категории
    const typesCount = await this.prisma.serviceType.count({
      where: { categoryId: id },
    });

    if (typesCount > 0) {
      throw new ConflictException(
        `Невозможно удалить категорию: существует ${typesCount} типов в этой категории`,
      );
    }

    await this.prisma.serviceCategory.delete({
      where: { id },
    });

    this.logger.log(`Удалена категория: ${existing.name}`);
  }
}

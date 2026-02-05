import { ClassConstructor, plainToInstance } from 'class-transformer';

export class FactoryDto {
  // Создание одного DTO
  static create<T, K>(
    dtoClass: ClassConstructor<T>,
    source: K,
    transform?: (data: K) => Partial<T>,
  ): T {
    const data = transform ? transform(source) : source;
    return plainToInstance(dtoClass, data, {
      excludeExtraneousValues: true,
    });
  }

  // Создание массива DTO
  static createMany<T, K>(
    dtoClass: ClassConstructor<T>,
    sources: K[],
    transform?: (data: K) => Partial<T>,
  ): T[] {
    return sources.map(source => this.create(dtoClass, source, transform));
  }
}

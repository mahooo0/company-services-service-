import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  {
    name: 'Ветклініки',
    slug: 'vet_clinics',
    types: [
      { name: 'Ротова порожнина і зуби', slug: 'dentistry' },
      { name: 'Шкіра, шерсть, вуха', slug: 'dermatology' },
      { name: 'Очі', slug: 'eyes' },
      { name: 'Нервова система', slug: 'nervous_system' },
      { name: 'Кістки, суглоби, опорно-руховий апарат', slug: 'bones_joints_musculoskeletal' },
      { name: 'Серце і судини', slug: 'heart_vessels' },
      { name: 'Дихальна система', slug: 'respiratory_system' },
      { name: 'Травлення і ШКТ', slug: 'digestion_gastrointestinal' },
      { name: 'Сечостатева система', slug: 'urinary_reproductive_system' },
      { name: 'Вакцинація і профілактика', slug: 'vaccination' },
      { name: 'Чіпування', slug: 'chipping' },
      { name: 'Діагностика і аналізи', slug: 'diagnostics' },
      { name: 'Хірургія', slug: 'surgery' },
      { name: 'Загальна терапія', slug: 'general_therapy' },
      { name: "Ін'єкції", slug: 'injections' },
      { name: 'Анестезія', slug: 'anesthesia' },
      { name: 'Стаціонар', slug: 'hospitalization' },
      { name: 'Онлайн-консультації', slug: 'consultations' },
      { name: 'Інше', slug: 'vet_other' },
    ],
  },
  {
    name: 'Грумінг',
    slug: 'grooming',
    types: [
      { name: 'Купання та сушка', slug: 'shampooing' },
      { name: 'Стрижка та тримінг', slug: 'dog_cat_grooming' },
      { name: 'Догляд за ротовою порожниною і зубами', slug: 'oral_care' },
      { name: 'Догляд за вухами', slug: 'ear_care' },
      { name: 'Догляд за лапами та кігтями', slug: 'manicure' },
      { name: 'Чистка параанальних залоз', slug: 'anal_gland_cleaning' },
      { name: 'Вичісування та догляд за шерстю', slug: 'hygienic_care' },
      { name: 'Обробка від бліх та кліщів', slug: 'antiparasitic_treatment' },
      { name: 'SPA та масаж', slug: 'spa_massage' },
      { name: 'Виїзд грумера додому', slug: 'groomer_home_visit' },
      { name: 'Інше', slug: 'grooming_other' },
    ],
  },
  {
    name: 'Готелі',
    slug: 'hotels',
    types: [
      { name: 'Догляд за собаками', slug: 'dog_care' },
      { name: 'Догляд за котами', slug: 'cat_care' },
      { name: 'Догляд за іншими тваринами', slug: 'other_pet_care' },
      { name: 'Харчування', slug: 'nutrition' },
      { name: 'Послуги грумінгу', slug: 'care_and_hygiene' },
      { name: 'Послуги ветеринара', slug: 'medical_services' },
      { name: 'Послуги кінолога / дресирування', slug: 'activities' },
      { name: 'Фото - відео звітність', slug: 'photo_video_reporting' },
      { name: 'Доставка / трансфер', slug: 'delivery_transfer' },
      { name: 'Інше', slug: 'hotel_other' },
    ],
  },
  {
    name: 'Вигул',
    slug: 'walking',
    types: [
      { name: 'Вигул', slug: 'walking' },
      { name: 'Інше', slug: 'walking_other' },
    ],
  },
  {
    name: 'Зоомагазини',
    slug: 'pet_store',
    types: [
      { name: 'Товари для собак', slug: 'dog_products' },
      { name: 'Товари для котів', slug: 'cat_products' },
      { name: 'Товари для птахів', slug: 'bird_products' },
      { name: 'Товари для рептилій', slug: 'reptile_products' },
      { name: 'Товари для гризунів', slug: 'rodent_products' },
      { name: 'Товари для риб', slug: 'fish_products' },
      { name: 'Офлайн-магазин', slug: 'offline_store' },
      { name: 'Онлайн-магазин', slug: 'online_store' },
      { name: 'Інше', slug: 'pet_store_other' },
    ],
  },
  {
    name: 'Кінологи/Хендлери',
    slug: 'dog_trainer',
    types: [
      { name: 'Дресирування', slug: 'training' },
      { name: 'Вигул із елементами дресирування', slug: 'walk_with_training_elements' },
      { name: 'Поведінкове консультування', slug: 'behavioral_consultation' },
      { name: 'Захисна / спеціальна підготовка', slug: 'protective_special_training' },
      { name: 'Виїзні заняття / заняття вдома', slug: 'home_or_offsite_lessons' },
      { name: 'Хендлінг', slug: 'handling' },
      { name: 'Підготовка до спорту', slug: 'sport_preparation' },
      { name: 'Інше', slug: 'trainer_other' },
    ],
  },
];

async function main() {
  console.log('Start seeding...');

  for (const categoryData of categories) {
    // Create or update category
    const category = await prisma.serviceCategory.upsert({
      where: { slug: categoryData.slug },
      update: { name: categoryData.name },
      create: {
        name: categoryData.name,
        slug: categoryData.slug,
      },
    });

    console.log(`Created/updated category: ${category.name}`);

    // Create or update types
    for (const typeData of categoryData.types) {
      await prisma.serviceType.upsert({
        where: { slug: typeData.slug },
        update: {
          name: typeData.name,
          categoryId: category.id,
        },
        create: {
          name: typeData.name,
          slug: typeData.slug,
          categoryId: category.id,
          status: 'ACTIVE',
        },
      });

      console.log(`  - Created/updated type: ${typeData.name}`);
    }
  }

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

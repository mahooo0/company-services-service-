
# Example Service Documentation

This documentation provides a comprehensive guide for the `example-service` project, which serves as a template for developing new microservices within the project ecosystem.

## Overview

The `example-service` is a NestJS-based microservice template that includes essential infrastructure components for building scalable and maintainable microservices. It provides integration with:

- **Consul** for service discovery and registration
- **PostgreSQL** for data persistence via Prisma ORM
- **RabbitMQ** for message queuing and event-driven architecture
- **Health checks** for service monitoring
- **Permission-based authorization** system

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (latest LTS version recommended)
- npm or pnpm
- Docker and Docker Compose (for local development)
- PostgreSQL (can be run via Docker)
- RabbitMQ (can be run via Docker)
- Consul (can be run via Docker)

## Project Structure

```
example-service/
├── prisma/                  # Prisma ORM configuration and schema
├── src/
│   ├── common/              # Common utilities, guards, and decorators
│   │   ├── decorators/      # Custom decorators (e.g., permission decorator)
│   │   └── guards/          # Guards for authorization
│   ├── consul/              # Consul service integration
│   ├── health/              # Health check endpoints
│   ├── prisma/              # Prisma service for database access
│   ├── rabbitmq/            # RabbitMQ integration for messaging
│   ├── app.controller.ts    # Main application controller
│   ├── app.module.ts        # Main application module
│   ├── app.service.ts       # Main application service
│   └── main.ts              # Application entry point
├── test/                    # Test files
├── .env                     # Environment variables
├── package.json             # Project dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── nest-cli.json            # NestJS CLI configuration
```

## Getting Started

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd example-service
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables:
   Copy the `.env.example` file to `.env` and update the values as needed. The main environment variables include:

   ```
   SERVICE_NAME=example-service
   SERVICE_HOST=localhost
   SERVICE_PORT=3000
   CONSUL_HOST=localhost
   CONSUL_PORT=8500
   SERVICE_ID=example-service-instance
   RABBITMQ_URL=amqp://guest:guest@localhost:5672
   DATABASE_URL=postgresql://postgres@localhost:5432/4friends?schema=public
   ```

### Database Setup

1. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

2. Run database migrations:
   ```bash
   npx prisma migrate dev
   npx prisma db push
   ```

### Running the Service

#### Development Mode

```bash
pnpm start:dev
```

This will start the service in development mode with hot-reload enabled.

#### Production Mode

```bash
pnpm build
pnpm start:prod
```

### Using Docker Compose

The project includes a `docker-compose.yml` file that sets up all the required infrastructure:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- RabbitMQ message broker
- Consul for service discovery
- Redis for caching (if needed)

## Key Features

### Service Registration with Consul

The service automatically registers itself with Consul on startup and deregisters on shutdown. This allows other services to discover it dynamically.

```typescript
// main.ts
const app = await NestFactory.create(AppModule);
const server = await app.listen(process.env.PORT ?? 0);
const port = server.address().port;
const consulService = app.get(ConsulService);
consulService.servicePort = port;
consulService.registerService(port);
```

### Database Access with Prisma

The service uses Prisma ORM for database access, providing type-safe database operations:

```typescript
// Example usage in a service
@Injectable()
export class ExampleService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.example.findMany();
  }
}
```

### Messaging with RabbitMQ

The service includes RabbitMQ integration for message-based communication between services:

```typescript
// Example usage in a service
@Injectable()
export class NotificationService {
  constructor(private rabbitmq: RabbitmqService) {}

  async sendNotification(data) {
    // Publish a message to a specific exchange with a routing key
    await this.rabbitmq.publish('notifications', 'user.created', data);
  }
}
```

### Permission-Based Authorization

The service includes a permission-based authorization system using guards and decorators:

```typescript
// Controller example
@Controller('resources')
export class ResourceController {
  @Get()
  @Permissions(['resources.read'], 'USER')
  findAll() {
    // This endpoint requires 'resources.read' permission
    // and is only accessible by users with account type 'USER'
    return this.resourceService.findAll();
  }
}
```

## Health Checks

The service exposes a health check endpoint at `/health` that can be used by Consul and other monitoring tools to verify the service's health:

```typescript
@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  checkHealth() {
    return this.health.check([]);
  }
}
```

## Extending the Template

### Adding New Modules

1. Create a new module using NestJS CLI:
   ```bash
   nest g module my-feature
   ```

2. Create controllers, services, and other components:
   ```bash
   nest g controller my-feature
   nest g service my-feature
   ```

3. Implement your business logic in the new module.

4. Import the module in `app.module.ts`:
   ```typescript
   @Module({
     imports: [
       // ... existing imports
       MyFeatureModule,
     ],
     // ...
   })
   export class AppModule {}
   ```

### Adding Database Models

1. Update the Prisma schema in `prisma/schema.prisma`:
   ```prisma
   model MyEntity {
     id        String   @id @default(uuid())
     name      String
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

2. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```

3. Create a migration:
   ```bash
   npx prisma migrate dev --name add_my_entity
   ```

## Troubleshooting

### Common Issues

1. **Service fails to register with Consul**
  - Ensure Consul is running and accessible
  - Check the CONSUL_HOST and CONSUL_PORT environment variables

2. **Database connection issues**
  - Verify the DATABASE_URL in the .env file
  - Ensure PostgreSQL is running and accessible

3. **RabbitMQ connection issues**
  - Check the RABBITMQ_URL in the .env file
  - Ensure RabbitMQ is running and accessible

## Conclusion

The `example-service` provides a solid foundation for building microservices in your project. It includes essential infrastructure components and follows best practices for microservice architecture. By using this template, you can quickly create new microservices that integrate seamlessly with your existing ecosystem.
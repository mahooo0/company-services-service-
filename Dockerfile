# Build stage
FROM node:18-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and configuration files
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy Prisma schema (needed for migrations and client generation)
COPY --from=builder /app/prisma/schema.prisma ./prisma/

# Generate Prisma client
RUN pnpm prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Create logs directory and set permissions BEFORE switching user
RUN mkdir -p /app/logs && chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Start the application
CMD ["sh", "-c", "pnpm run start:prod"]
# Build stage
FROM node:24.13.1-alpine AS builder

WORKDIR /usr/app

COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:24.13.1-alpine

WORKDIR /usr/app

# Copy dependencies from builder
COPY --from=builder /usr/app/node_modules ./node_modules

# Copy application files
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY src ./src

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001 && \
  chown -R nodejs:nodejs /usr/app

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
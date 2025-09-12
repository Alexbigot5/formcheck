FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create a simple entrypoint script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'echo "Starting SmartForms Backend..."' >> /app/entrypoint.sh && \
    echo 'exec npx tsx src/server.ts' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Expose port
EXPOSE $PORT

# Use the entrypoint script
CMD ["/app/entrypoint.sh"]

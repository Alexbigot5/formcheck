FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Copy source code (excluding test files)
COPY src ./src/
COPY tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Skip TypeScript compilation - using tsx for runtime
RUN echo "=== BACKEND CONFIGURED FOR TSX RUNTIME ===" && \
    echo "TypeScript files will be run directly with tsx" && \
    ls -la src/

# Expose port (Railway will set PORT dynamically)
EXPOSE 4000

# Create a startup script with debugging
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "=== CONTAINER STARTING ==="' >> /app/start.sh && \
    echo 'echo "Node version: $(node --version)"' >> /app/start.sh && \
    echo 'echo "Environment variables:"' >> /app/start.sh && \
    echo 'env | grep -E "(NODE_ENV|PORT|DATABASE_URL|JWT_SECRET)" || echo "No relevant env vars found"' >> /app/start.sh && \
    echo 'echo "Starting Node.js application with tsx..."' >> /app/start.sh && \
    echo 'npx tsx src/server.ts' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start with debugging script
CMD ["/app/start.sh"]

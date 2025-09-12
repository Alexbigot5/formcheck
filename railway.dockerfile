FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY backend/prisma ./prisma/

# Copy source code (excluding test files)
COPY backend/src ./src/

# Debug: List what's actually in the backend directory
RUN echo "=== LISTING BACKEND DIRECTORY ===" && \
    ls -la backend/ || echo "backend directory not found"

COPY backend/tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript to JavaScript  
RUN echo "=== COMPILING TYPESCRIPT ===" && \
    echo "Files in current directory:" && \
    ls -la && \
    echo "Checking tsconfig.json:" && \
    cat tsconfig.json && \
    npx tsc && \
    echo "=== TYPESCRIPT COMPILATION COMPLETE ===" && \
    ls -la dist/ && \
    echo "=== DIST DIRECTORY CONTENTS ==="

# Expose port (Railway will set PORT dynamically)
EXPOSE 4000

# Create a startup script with debugging
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "=== CONTAINER STARTING ==="' >> /app/start.sh && \
    echo 'echo "Node version: $(node --version)"' >> /app/start.sh && \
    echo 'echo "Environment variables:"' >> /app/start.sh && \
    echo 'env | grep -E "(NODE_ENV|PORT|DATABASE_URL|JWT_SECRET)" || echo "No relevant env vars found"' >> /app/start.sh && \
    echo 'echo "Starting Node.js application..."' >> /app/start.sh && \
    echo 'node dist/server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start with debugging script
CMD ["/app/start.sh"]

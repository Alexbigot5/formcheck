FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy prisma schema
COPY backend/prisma ./prisma/

# Copy source code and config files
COPY backend/src ./src/

# Create tsconfig.json from backend directory or use a working copy
RUN echo "Checking what files are available:" && \
    find . -name "*.json" -type f && \
    echo "Trying to copy tsconfig.json..." && \
    ls -la backend/ || echo "No backend dir" && \
    cp backend/tsconfig.json ./tsconfig.json || echo "Copy failed, creating basic tsconfig.json" && \
    if [ ! -f tsconfig.json ]; then \
        echo '{"compilerOptions":{"target":"ES2021","lib":["ES2021"],"module":"CommonJS","moduleResolution":"node","outDir":"dist","rootDir":"src","strict":false,"esModuleInterop":true,"allowSyntheticDefaultImports":true,"forceConsistentCasingInFileNames":false,"skipLibCheck":true,"resolveJsonModule":true,"declaration":false,"types":["node"]},"include":["src/**/*"],"exclude":["node_modules","dist","**/*.test.ts"]}' > tsconfig.json; \
    fi

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

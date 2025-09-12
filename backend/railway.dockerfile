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

# Build TypeScript to JavaScript
RUN npx tsc

# Expose port (Railway will set PORT dynamically)
EXPOSE 4000

# Start with compiled JavaScript instead of tsx
CMD ["node", "dist/server.js"]

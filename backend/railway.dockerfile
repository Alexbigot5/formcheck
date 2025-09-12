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

# Expose port
EXPOSE $PORT

# Start directly with tsx to avoid any npm script issues
CMD ["npx", "tsx", "src/server.ts"]

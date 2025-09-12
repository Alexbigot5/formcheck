FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev dependencies for tsx)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Expose port (Railway uses PORT env var)
EXPOSE $PORT

# Start the application
CMD ["npm", "start"]

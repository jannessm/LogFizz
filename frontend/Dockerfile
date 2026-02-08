# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy lib directory (shared dependency)
COPY lib/package*.json ./lib/
COPY lib/tsconfig.json ./lib/

# Install lib dependencies
WORKDIR /app/lib
RUN npm ci

# Copy lib source and build it
COPY lib/ ./
RUN npm run build

# Copy frontend package files
WORKDIR /app
COPY frontend/package*.json ./frontend/

# Install frontend dependencies
WORKDIR /app/frontend
RUN npm ci

# Copy frontend source code
COPY frontend/ ./

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

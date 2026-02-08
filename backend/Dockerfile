FROM node:22-alpine

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

# Copy backend package files
WORKDIR /app
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci 

# Copy backend source code
COPY backend/ ./

# Build TypeScript
RUN npm run build --omit=dev

# Expose port
EXPOSE 3000

# Ensure we're in the backend directory
WORKDIR /app/backend

# Start the application
CMD ["npm", "start"]

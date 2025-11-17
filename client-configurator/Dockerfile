# Dockerfile for Galgo-School Client
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Install serve and curl for health check
RUN npm install -g serve && apk add --no-cache curl

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5173/ || exit 1

# Start the application - bind to 0.0.0.0 for external access
CMD ["serve", "-s", "dist", "-l", "5173", "--no-clipboard", "--single"]

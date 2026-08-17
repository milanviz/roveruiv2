# Stage 1: Build the Vite application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies cleanly
RUN npm ci

# Copy full application source
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:alpine AS runner

# Replace default Nginx configuration with SPA & proxy config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

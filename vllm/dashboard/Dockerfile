FROM node:20-bullseye-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY public ./public

# Create log directory
RUN mkdir -p /var/log/dashboard

# Run as non-root user
RUN groupadd -r dashboard && useradd -r -g dashboard dashboard
RUN chown -R dashboard:dashboard /app /var/log/dashboard
USER dashboard

EXPOSE 4242

CMD ["node", "server.js"]

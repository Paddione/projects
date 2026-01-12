FROM node:20-bullseye-slim

WORKDIR /app

# Install Docker CLI and docker-compose
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli docker-compose-plugin \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY server.js ./
COPY public ./public

# Create log directory
RUN mkdir -p /var/log/dashboard

# Run as non-root user
RUN groupadd -r dashboard && useradd -r -g dashboard dashboard
RUN chown -R dashboard:dashboard /app /var/log/dashboard

# Note: Running as root to access docker socket. In production, add user to docker group instead.
# USER dashboard

EXPOSE 4242

CMD ["node", "server.js"]

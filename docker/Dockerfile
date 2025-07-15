# Dockerfile for CPower Dispatch Event Automation - Google Cloud Run
# Single container with nginx routing to both services

FROM ubuntu:22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Basic tools
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    # Python 3.11
    python3.11 \
    python3.11-dev \
    python3-pip \
    # Node.js prerequisites
    ca-certificates \
    gnupg \
    lsb-release \
    # Chromium for Puppeteer
    chromium-browser \
    # Required libraries for Puppeteer
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libgbm1 \
    libasound2 \
    # Nginx for reverse proxy
    nginx \
    # Process management
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Set Python 3.11 as default and ensure pip works with it
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 && \
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app directory
WORKDIR /app

# Copy package files for Node.js
COPY package*.json ./
COPY tsconfig.json ./

# Install Node.js dependencies
RUN npm ci

# Copy application files
COPY . .

# Install Python dependencies after copying all files using python3.11
RUN python3.11 -m pip install --no-cache-dir --ignore-installed --break-system-packages -r ai_assistant_cdea/requirements.txt && \
    python3.11 -m pip list | grep -E "flask|Flask" && \
    echo "Testing Python imports..." && \
    python3.11 docker/test_imports.py

# Build TypeScript
RUN npm run build

# Create necessary directories
RUN mkdir -p /app/logs /app/temp /app/data /app/screenshots

# Configure nginx
RUN echo 'server { \n\
    listen 8080; \n\
    \n\
    # Main dispatch server \n\
    location / { \n\
        proxy_pass http://127.0.0.1:3000; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Upgrade $http_upgrade; \n\
        proxy_set_header Connection "upgrade"; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \n\
        proxy_set_header X-Forwarded-Proto $scheme; \n\
    } \n\
    \n\
    # AI Assistant API \n\
    location /ai/ { \n\
        rewrite ^/ai/(.*) /$1 break; \n\
        proxy_pass http://127.0.0.1:3333; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Upgrade $http_upgrade; \n\
        proxy_set_header Connection "upgrade"; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \n\
        proxy_set_header X-Forwarded-Proto $scheme; \n\
    } \n\
    \n\
    # Socket.IO for AI Assistant \n\
    location /socket.io/ { \n\
        proxy_pass http://127.0.0.1:3333; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Upgrade $http_upgrade; \n\
        proxy_set_header Connection "upgrade"; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \n\
        proxy_set_header X-Forwarded-Proto $scheme; \n\
    } \n\
}' > /etc/nginx/sites-available/default

# Configure supervisor
RUN echo '[supervisord] \n\
nodaemon=true \n\
logfile=/app/logs/supervisord.log \n\
pidfile=/var/run/supervisord.pid \n\
\n\
[program:nginx] \n\
command=/usr/sbin/nginx -g "daemon off;" \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stderr_logfile=/dev/stderr \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile_maxbytes=0 \n\
\n\
[program:dispatch-server] \n\
command=node /app/dist/index.js \n\
directory=/app \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stderr_logfile=/dev/stderr \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile_maxbytes=0 \n\
environment=NODE_ENV="production",PORT="3000" \n\
\n\
[program:ai-assistant] \n\
command=python3.11 /app/ai_assistant_cdea/api_server.py \n\
directory=/app \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stderr_logfile=/dev/stderr \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile_maxbytes=0 \n\
environment=PYTHONUNBUFFERED="1",PORT="3333",PYTHONPATH="/app/ai_assistant_cdea"' > /etc/supervisor/conf.d/supervisord.conf

# Environment variables
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Cloud Run expects port 8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
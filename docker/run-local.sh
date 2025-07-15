#!/bin/bash

# Script to build and run the CPower Dispatch Docker container locally

echo "Building Docker image..."
docker build -f docker/Dockerfile -t cpow-dispatch:local .

if [ $? -ne 0 ]; then
    echo "Docker build failed!"
    exit 1
fi

echo "Build successful! Starting container..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create a .env file with required environment variables"
    echo "See docker/ENV_REQUIREMENTS.md for details"
    exit 1
fi

# Load environment variables from .env file
export $(cat .env | grep -v '^#' | xargs)

# Verify critical variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "ERROR: ANTHROPIC_API_KEY not set in .env file!"
    exit 1
fi

if [ -z "$FLASK_SECRET_KEY" ]; then
    echo "WARNING: FLASK_SECRET_KEY not set, generating a random one..."
    export FLASK_SECRET_KEY=$(openssl rand -hex 32)
fi

# Stop any existing container
docker stop cpow-dispatch-local 2>/dev/null
docker rm cpow-dispatch-local 2>/dev/null

# Run the container
docker run -d \
  --name cpow-dispatch-local \
  -p 8080:8080 \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e FLASK_SECRET_KEY="$FLASK_SECRET_KEY" \
  -e SMTP_HOST="$SMTP_HOST" \
  -e SMTP_PORT="$SMTP_PORT" \
  -e SMTP_USER="$SMTP_USER" \
  -e SMTP_PASSWORD="$SMTP_PASSWORD" \
  -e PORTAL_URL="$PORTAL_URL" \
  -e PORTAL_USERNAME="$PORTAL_USERNAME" \
  -e PORTAL_PASSWORD="$PORTAL_PASSWORD" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e TEST_EMAIL="$TEST_EMAIL" \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/logs:/app/logs" \
  cpow-dispatch:local

if [ $? -eq 0 ]; then
    echo "Container started successfully!"
    echo ""
    echo "Services available at:"
    echo "  - Main dispatch server: http://localhost:8080"
    echo "  - AI Assistant API: http://localhost:8080/ai"
    echo ""
    echo "View logs with: docker logs -f cpow-dispatch-local"
    echo "Stop with: docker stop cpow-dispatch-local"
else
    echo "Failed to start container!"
    exit 1
fi
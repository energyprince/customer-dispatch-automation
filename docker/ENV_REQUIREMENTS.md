# Docker Environment Variables for AI Assistant

## Required Environment Variables

The following environment variables MUST be provided when running the Docker container for the AI Assistant to function properly:

### Critical Variables (Required)

1. **ANTHROPIC_API_KEY**
   - Description: API key for Claude AI service
   - Required by: AI Assistant service
   - Example: `sk-ant-api03-...`

2. **FLASK_SECRET_KEY**
   - Description: Secret key for Flask session management
   - Required by: AI Assistant Flask application
   - Example: Any random string (use a secure generator)

### Optional Variables (Have Defaults)

3. **PORT**
   - Description: Port for AI Assistant service
   - Default: 3333 (set in supervisor config)
   - Note: Change only if you also update nginx config

## Docker Run Example

```bash
docker run -d \
  --name cpow-dispatch \
  -p 8080:8080 \
  -e ANTHROPIC_API_KEY="your-anthropic-api-key" \
  -e FLASK_SECRET_KEY="your-secure-secret-key" \
  -e SMTP_HOST="smtp.gmail.com" \
  -e SMTP_PORT="587" \
  -e SMTP_USER="your-email@gmail.com" \
  -e SMTP_PASSWORD="your-app-password" \
  -e PORTAL_URL="https://portal.cpowerenergy.com" \
  -e PORTAL_USERNAME="your-portal-username" \
  -e PORTAL_PASSWORD="your-portal-password" \
  your-docker-image:tag
```

## Docker Compose Example

Create a `.env` file with your variables:

```env
# AI Assistant
ANTHROPIC_API_KEY=sk-ant-api03-...
FLASK_SECRET_KEY=your-secure-secret-key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Portal Access
PORTAL_URL=https://portal.cpowerenergy.com
PORTAL_USERNAME=your-username
PORTAL_PASSWORD=your-password
```

Then run:
```bash
docker-compose up -d
```

## Verification

To verify the AI Assistant is running correctly:

1. Check supervisor logs:
   ```bash
   docker logs <container-id> | grep AI-ASSISTANT
   ```

2. Test the AI endpoint:
   ```bash
   curl http://localhost:8080/ai/health
   ```

3. Check if all services are running:
   ```bash
   docker exec <container-id> supervisorctl status
   ```

## Troubleshooting

If the AI Assistant fails to start:

1. **Missing ANTHROPIC_API_KEY**: You'll see an error in logs about missing API key
2. **Import errors**: Check that all Python dependencies installed correctly
3. **Port conflicts**: Ensure port 3333 is available inside the container
4. **Memory issues**: AI Assistant may need adequate memory allocation

## Security Notes

- Never commit `.env` files to version control
- Use Docker secrets for production deployments
- Rotate API keys regularly
- Use strong, unique values for FLASK_SECRET_KEY
# CPower Dispatch Automation API Server

## Overview

This Flask-based API server provides RESTful endpoints and WebSocket support for the CPower Dispatch Automation system. It enables real-time chat interactions, system testing, and configuration validation.

## Features

- **RESTful API** with JSON responses
- **WebSocket support** for real-time chat
- **CORS enabled** for cross-origin requests
- **File upload support** for Excel validation and email parsing
- **Session management** for conversation tracking
- **Comprehensive error handling** and logging
- **Metrics tracking** for system monitoring

## Installation

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Ensure the `.env` file exists in the parent directory with required configuration:
   ```env
   # SMTP Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password

   # Portal Configuration
   PORTAL_URL=https://portal.cpowerenergy.com
   PORTAL_USERNAME=your-username
   PORTAL_PASSWORD=your-password

   # Optional
   TEST_EMAIL=test@example.com
   SECRET_KEY=your-secret-key
   ```

## Quick Start

### Using the startup script:
```bash
./start_api.sh
```

### Manual start:
```bash
python api_server.py
```

### Production deployment with Gunicorn:
```bash
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 api_server:app
```

## API Endpoints

### 1. Chat Endpoint
**POST** `/chat`
```json
{
  "message": "What dispatch events are scheduled?",
  "session_id": "user123"
}
```

### 2. Test SMTP
**POST** `/test/smtp`
```json
{
  "test_email": "recipient@example.com"  // Optional
}
```

### 3. Test Portal
**POST** `/test/portal`

Tests portal login credentials from environment variables.

### 4. Validate Contacts
**POST** `/validate/contacts`

Upload Excel file with `multipart/form-data`:
- Field name: `file`
- File type: `.xlsx` or `.xls`

### 5. Parse Email
**POST** `/parse/email`

Option 1 - JSON body:
```json
{
  "content": "Email content here..."
}
```

Option 2 - File upload with `multipart/form-data`:
- Field name: `file`
- File type: `.txt` or `.eml`

### 6. System Status
**GET** `/status`

Returns system health, metrics, and configuration status.

### 7. List Sessions
**GET** `/sessions`

Returns all active chat sessions.

### 8. Export Session
**POST** `/sessions/{session_id}/export`

Downloads session history as JSON file.

### 9. Clear Session
**DELETE** `/sessions/{session_id}`

Removes a session from memory.

## WebSocket Events

### Client to Server Events

1. **join_session**
   ```javascript
   socket.emit('join_session', { session_id: 'user123' });
   ```

2. **chat_message**
   ```javascript
   socket.emit('chat_message', { 
     message: 'Hello assistant',
     session_id: 'user123' 
   });
   ```

3. **leave_session**
   ```javascript
   socket.emit('leave_session', { session_id: 'user123' });
   ```

### Server to Client Events

1. **connected** - Confirmation of connection
2. **joined_session** - Confirmation of joining session
3. **processing** - Message being processed
4. **chat_response** - Assistant's response
5. **error** - Error occurred

## Example Usage

### Python Client
```python
import requests

# Chat example
response = requests.post('http://localhost:5000/chat', json={
    'message': 'Help me understand today\'s dispatch event',
    'session_id': 'test_session'
})
print(response.json()['response'])

# Test SMTP
smtp_test = requests.post('http://localhost:5000/test/smtp', json={
    'test_email': 'test@example.com'
})
print(smtp_test.json())
```

### JavaScript/WebSocket Client
```javascript
const socket = io('http://localhost:5000');

socket.on('connect', () => {
    console.log('Connected');
    socket.emit('join_session', { session_id: 'web_user' });
});

socket.on('chat_response', (data) => {
    console.log('Assistant:', data.response);
});

socket.emit('chat_message', {
    message: 'What facilities are affected today?',
    session_id: 'web_user'
});
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "success": false
}
```

HTTP status codes:
- 200: Success
- 400: Bad Request (missing parameters)
- 404: Not Found (session/resource not found)
- 500: Internal Server Error

## Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **File Uploads**: Limited to 16MB by default
3. **CORS**: Configure allowed origins for production
4. **Session Management**: Sessions are stored in memory (use Redis for production)
5. **Authentication**: Add JWT or API key authentication for production

## Monitoring

The `/status` endpoint provides:
- Uptime
- Request counts
- Success/failure rates
- Active sessions
- Configuration status

## Testing

Use the included `example_client.py` to test all endpoints:

```bash
python example_client.py
```

## Troubleshooting

1. **Port already in use**: Change port in environment or kill existing process
2. **SMTP test fails**: Check firewall, credentials, and app passwords
3. **WebSocket connection fails**: Ensure eventlet is installed
4. **File upload fails**: Check file size and format

## Production Deployment

1. Use environment variables for all sensitive data
2. Set up reverse proxy (nginx) for SSL/TLS
3. Use Redis for session storage
4. Implement rate limiting
5. Add authentication middleware
6. Set up logging to file/service
7. Monitor with tools like Prometheus/Grafana
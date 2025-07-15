# CPower Dispatch Automation AI Assistant

This module provides an AI-powered assistant specifically designed for the CPower Dispatch Event Automation system. It helps users configure, troubleshoot, and manage the automated dispatch notification workflow.

## Overview

The Dispatch Assistant helps with:
- **Email Configuration**: SMTP setup for Gmail/Office 365
- **Portal Automation**: Troubleshooting screenshot capture issues
- **Contact Management**: Excel file validation and facility mapping
- **Dispatch Parsing**: Understanding and fixing email parsing problems
- **Testing**: Safe testing procedures and validation

## Structure

```
ai_assistant_cdea/
├── __init__.py                  # Package initialization
├── assistant.py                 # Main DispatchAssistant class
├── claude_client.py             # Claude API client wrapper
├── context_manager.py           # Dispatch file context management
├── conversation_memory.py       # Session-based conversation history
├── api_server.py               # Flask API server with WebSocket support
├── index.html                  # Web-based chat interface
├── app.js                      # Frontend JavaScript
├── style.css                   # Custom styling
└── prompts/
    ├── __init__.py
    ├── prompt_loader.py        # Prompt versioning system
    └── dispatch_assistant_v1.txt   # Dispatch-specific system prompt
```

## Features

### 1. Dispatch-Specific Capabilities
- **SMTP Validation**: Test email configuration before sending
- **Portal Access Check**: Verify CPower portal credentials
- **Contact Mapping**: Validate facility contacts from Excel files
- **Dispatch Email Parsing**: Analyze and troubleshoot parsing issues

### 2. Web Interface
- Modern chat interface with real-time updates
- Quick action buttons for common tasks
- Status panel showing system health
- Dark mode support
- Export conversation history

### 3. API Endpoints
- `POST /chat` - Interactive chat with the assistant
- `POST /test/smtp` - Test SMTP email configuration
- `POST /test/portal` - Validate portal credentials
- `POST /validate/contacts` - Check Excel contact files
- `POST /parse/email` - Parse dispatch email content
- `GET /status` - System health and metrics
- `GET /sessions` - List conversation sessions
- `WebSocket /ws` - Real-time chat connection

## Setup

### 1. Environment Configuration
Create a `.env` file with:
```bash
# Claude API
ANTHROPIC_API_KEY=your-api-key-here
CLAUDE_MODEL=claude-3-haiku-20240307  # Optional

# Email Configuration (for SMTP testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Portal Configuration (for validation)
PORTAL_URL=https://portal.cpowerenergy.com
PORTAL_USERNAME=your-username
PORTAL_PASSWORD=your-password

# Optional
TEST_EMAIL=test@example.com  # Redirect all emails here for testing
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start the API Server
```bash
python api_server.py
# Or use the startup script:
./start_api.sh
```

### 4. Access the Web Interface
Open `http://localhost:3333` in your browser

## Usage Examples

### Using the Web Interface
1. Navigate to `http://localhost:3333`
2. Ask questions about dispatch automation
3. Use quick action buttons for common tasks
4. Export conversations for documentation

### Using the Python API
```python
from ai_assistant_cdea.assistant import DispatchAssistant

# Initialize assistant
assistant = DispatchAssistant()

# Ask about email configuration
response = assistant.process_query(
    query="How do I configure Office 365 SMTP?",
    session_id="session-123"
)

# Validate SMTP configuration
smtp_result = assistant.validate_smtp_config()
print(f"SMTP Valid: {smtp_result['valid']}")

# Check portal access
portal_result = assistant.validate_portal_access()
print(f"Portal Access: {portal_result['valid']}")

# Diagnose dispatch parsing
email_content = "Dispatch Event: Aaron Industries..."
parsing_result = assistant.diagnose_dispatch_parsing(email_content)

# Check contact mapping
contact_result = assistant.check_contact_mapping("Aaron Industries")
```

### Using the REST API
```bash
# Chat with the assistant
curl -X POST http://localhost:3333/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How do I test email configuration?", "session_id": "test-session"}'

# Test SMTP configuration
curl -X POST http://localhost:3333/test/smtp

# Validate portal access
curl -X POST http://localhost:3333/test/portal

# Parse dispatch email
curl -X POST http://localhost:3333/parse/email \
  -F "file=@dispatch_email.txt"
```

## Context Management

The assistant intelligently selects relevant files based on your query:
- **Email queries** → `emailSender.ts`, `CLAUDE.md`
- **Portal issues** → `portalAutomation.ts`
- **Dispatch parsing** → `customerDispatchParser.ts`
- **Contact questions** → `excelReader.ts`

## Testing

### Test Scripts
The system includes several test scripts in `src/tests/phase3/`:
- `test-aaron-safe.ts` - Safe testing with TEST_EMAIL
- `test-email-only.ts` - Email functionality testing
- `test-aaron-industries.ts` - Full workflow testing

### Running Tests
```bash
# Always use TEST_EMAIL for safety
export TEST_EMAIL="your-test@example.com"

# Run safe test
TS_NODE_TRANSPILE_ONLY=true npx ts-node src/tests/phase3/test-aaron-safe.ts
```

## Troubleshooting

### Common Issues
1. **SMTP Authentication Failed**
   - Check SMTP_USER and SMTP_PASSWORD
   - For Office 365, ensure SMTP AUTH is enabled
   - Use app passwords for accounts with MFA

2. **Portal Screenshot Errors**
   - Verify PORTAL_URL is correct
   - Check portal credentials
   - Ensure Chromium/Puppeteer is installed

3. **Contact Not Found**
   - Verify Excel file path in configuration
   - Check facility name spelling
   - Ensure Excel file has proper column headers

## Development

### Adding New Features
1. Add helper methods to `assistant.py`
2. Update context mappings in `context_manager.py`
3. Add new API endpoints in `api_server.py`
4. Update the web interface as needed

### Extending the Assistant
- Add new dispatch-specific prompts
- Create specialized validation methods
- Implement additional debugging tools

## Security Notes
- Never commit `.env` files
- Use app passwords instead of regular passwords
- Run tests with TEST_EMAIL configured
- Validate all user inputs in the API

## Support
For issues or questions about the dispatch automation system:
1. Check the assistant's suggestions first
2. Review logs in the application
3. Test components individually
4. Use safe testing mode before production
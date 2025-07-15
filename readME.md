# CPower Dispatch Server

An automated system that monitors CPower dispatch emails and sends real-time energy usage notifications to facility managers during curtailment events.

## 🎯 What It Does

When CPower initiates an energy curtailment event:
1. **Detects** dispatch emails automatically
2. **Extracts** all affected facilities (typically 40-50 sites)
3. **Schedules** notifications for 10 minutes after event start
4. **Captures** real-time energy usage screenshots from your portal
5. **Notifies** all facility contacts with their current usage data

### Example Flow
```
6:00 PM - Curtailment event starts
6:10 PM - System automatically:
  → Logs into energy portal
  → Takes screenshot of each facility's usage
  → Emails facility managers: "Hey! Just showing you how you're doing 10 minutes into the event!"
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Email account with IMAP access
- SMTP server for sending emails
- Access to your energy monitoring portal
- Excel file with facility contacts

### Installation

```bash
# Clone the repository
git clone https://github.com/yourcompany/cpower-dispatch-server.git
cd cpower-dispatch-server

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Configuration

Create a `.env` file with your credentials:

```env
# Email Monitoring (IMAP)
EMAIL_USER=dispatch@yourcompany.com
EMAIL_PASSWORD=your-app-password
EMAIL_HOST=imap.gmail.com

# Email Sending (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notifications@yourcompany.com
SMTP_PASSWORD=your-smtp-password

# Energy Portal
PORTAL_URL=https://energyportal.com/login
PORTAL_USERNAME=your-username
PORTAL_PASSWORD=your-password

# Testing
TEST_EMAIL=your-email@example.com

# Timezone
TZ=America/New_York
```

### Add Your Contact List

Place your Excel file in the `data/` directory:
```
data/ISONE_Facility Contact Report_06202025.xlsx
```

The Excel should have columns for:
- Facility (exact name matching dispatch emails)
- Company
- First Name
- Last Name
- Email

### Testing

Test the system module by module:

```bash
# Test basic services (Excel, Parser, Tracker)
npm run test:1

# Test external connections (Email, Screenshots)
npm run test:2

# Test integrations (Monitor, Scheduler)
npm run test:3

# Test complete workflow
npm run test:4
```

### Running

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm run build
npm start

# Using PM2 (recommended for production)
pm2 start dist/index.js --name cpower-dispatch
```

## 📁 Project Structure

```
cpower-dispatch-server/
├── src/
│   ├── types/              # TypeScript interfaces
│   ├── services/           # Core service modules
│   │   ├── emailMonitor.ts       # IMAP email monitoring
│   │   ├── cpowerEmailParser.ts  # Parse dispatch emails
│   │   ├── excelService.ts       # Read facility contacts
│   │   ├── screenshotService.ts  # Portal automation
│   │   ├── emailSender.ts        # Send notifications
│   │   ├── scheduler.ts          # Job scheduling
│   │   └── processedTracker.ts   # Prevent duplicates
│   ├── tests/              # Test suites
│   └── index.ts            # Main entry point
├── data/                   # Excel files and tracking
├── screenshots/            # Temporary screenshot storage
├── .env                    # Environment variables
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript config
```

## 🔧 How It Works

### Email Detection
- Monitors inbox every 30 seconds
- Looks for "dispatch" in subject line
- Tracks processed emails to prevent duplicates

### Facility Parsing
Extracts from CPower emails:
- Facility names and addresses
- Account numbers
- Event start/end times
- Dispatch targets

### Contact Matching
- Reads Excel file with facility → contact mappings
- Supports multiple contacts per facility
- Matches by exact facility name

### Screenshot Automation
Using Playwright:
1. Launches headless Chrome
2. Logs into energy portal
3. Searches for facility
4. Captures usage graph/data
5. Saves screenshot temporarily

### Notification Scheduling
- Uses node-cron for precise timing
- Schedules for event start + 10 minutes
- Handles timezone conversions
- Runs jobs in parallel

## 📊 Typical Dispatch Processing

For a standard CPower dispatch:
- **48 facilities** listed
- **~200 emails** sent (varies by contacts per facility)
- **10 minute** delay after event start
- **2-3 minutes** to process all facilities
- **500KB** per screenshot

## 🛠️ Customization

### Email Parser
Edit `src/services/cpowerEmailParser.ts` if dispatch format changes:
```typescript
// Adjust patterns for different formats
private sitePattern = /Site:\s*([^\n]+)/gi;
private timePattern = /Event Time:\s*([^\n]+)/gi;
```

### Portal Automation
Update `src/services/screenshotService.ts` for your portal:
```typescript
// Update selectors
await page.fill('input[name="username"]', username);
await page.click('button[type="submit"]');
await page.waitForSelector('.usage-chart');
```

### Email Template
Modify in `src/services/emailSender.ts`:
```typescript
subject: `Quick Update: ${event.site} - 10 Minutes Into Curtailment`,
html: `<p>Hey ${contact.contactName}! 👋</p>...`
```

## 🚨 Troubleshooting

### Email Not Connecting
```
Error: Connection timeout
```
- Check EMAIL_HOST and port
- For Gmail: Enable IMAP in settings
- Use app-specific password for 2FA

### Screenshots Failing
```
Error: Timeout exceeded while waiting for selector
```
- Verify PORTAL_URL is correct
- Check login credentials
- Update selectors if portal changed
- Increase timeout values

### Contacts Not Found
```
Warning: No contacts found for facility
```
- Check Excel facility names match exactly
- Ensure Excel is in correct format
- Verify file path in excelService.ts

### Emails Not Sending
```
Error: Invalid login
```
- Verify SMTP credentials
- Check port (587 for TLS, 465 for SSL)
- Ensure firewall allows SMTP

## 📈 Monitoring

### Logs
The system provides detailed logs:
```
✓ Connected to email server
📧 New dispatch email received
✓ Parsed 48 facilities
✓ Found 3 contacts for Rhode Island Hospital
📸 Capturing usage data...
✓ Screenshot captured successfully
📧 Notification sent to tony@example.com
```

### Health Checks
- Active job count logged every 5 minutes
- Failed deliveries logged with details
- Processing summary after each dispatch

## 🔐 Security

- Credentials stored in environment variables
- Processed emails tracked locally (no database)
- Screenshots deleted after sending
- No sensitive data in logs

## 🚀 Production Deployment

### Using PM2
```bash
# Install PM2
npm install -g pm2

# Build and start
npm run build
pm2 start dist/index.js --name cpower-dispatch

# Auto-restart on failure
pm2 startup
pm2 save

# View logs
pm2 logs cpower-dispatch
```

### Using systemd
```ini
[Unit]
Description=CPower Dispatch Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/cpower-dispatch-server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 📝 Maintenance

### Daily
- Check logs for any failed notifications
- Verify screenshots are being cleaned up

### Weekly
- Review processed-emails.json size
- Check for Excel file updates

### Monthly
- Update portal selectors if UI changed
- Clean old entries from processed-emails.json
- Review contact list accuracy

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -am 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing`)
5. Open Pull Request

## 📄 License

This project is proprietary and confidential.

## 🆘 Support

For issues or questions:
- Internal: #energy-systems Slack channel
- Email: energy-tech@yourcompany.com
- CPower Dispatch: 410-346-5907

---

Built with ❤️ for automated energy management
# CPower Dispatch Automation - Email Configuration Guide

## Overview
This document provides instructions for configuring email services in the CPower Dispatch Automation system. The system can use either Gmail or Office 365/Outlook for sending automated dispatch notifications.

## Current Configuration (Gmail)

The system is currently configured to use Gmail for sending emails:

```env
# Email Sending (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="lightsaber874@gmail.com"
SMTP_PASSWORD="iodt jmae fruk siiy"  # App password
```

## Migration to Office 365/Outlook

To use the CPower corporate email account (northeast@CPowerEnergy.com), update the `.env` file with these settings:

```env
# Email Sending (SMTP)
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="northeast@CPowerEnergy.com"
SMTP_PASSWORD="[Office 365 password or app password]"
```

### Prerequisites for Office 365

1. **Enable SMTP AUTH**:
   - Log in to Office 365 Admin Center
   - Go to Users > Active Users
   - Select the northeast@CPowerEnergy.com user
   - Click Mail Settings
   - Under Email apps, toggle "Authenticated SMTP" to ON

2. **Multi-Factor Authentication**:
   - If MFA is enabled, create an app password:
   - Go to https://mysignins.microsoft.com/security-info
   - Add method > App password
   - Use this app password in SMTP_PASSWORD

3. **Domain Configuration**:
   - Ensure cpowerenergy.com has proper SPF records
   - SPF should include: `v=spf1 include:spf.protection.outlook.com -all`

## How Emails Are Sent

The system sends emails through the `EmailSender` service (`src/services/emailSender.ts`):

1. **Sender Display**: Emails show as from "L.R.U" (Leo's Robot Underling)
2. **Subject**: "THIS MESSAGE WAS SENT BY LEO'S ROBOT UNDERLING"
3. **Content**: HTML email with facility usage data and screenshots
4. **Attachments**: Portal usage screenshots when available

## Testing the Configuration

### 1. Test SMTP Connection
```bash
# Create a simple test script
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
transporter.verify().then(() => console.log('✓ SMTP connection successful')).catch(console.error);
"
```

### 2. Send Test Email
Use the Aaron Industries test script with TEST_EMAIL configured:

```bash
# Set test recipient in .env
TEST_EMAIL="your-email@example.com"

# Run the safe test (redirects all emails to TEST_EMAIL)
TS_NODE_TRANSPILE_ONLY=true npx ts-node src/tests/phase3/test-aaron-safe.ts
```

### 3. Available Test Scripts
- `test-aaron-safe.ts` - Requires TEST_EMAIL, sends all emails to test address
- `test-aaron-industries.ts` - Can run with or without TEST_EMAIL
- `test-email-only.ts` - Tests email sending without portal screenshots

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify SMTP AUTH is enabled in Office 365
   - Check if MFA is enabled (use app password if yes)
   - Ensure credentials are correct

2. **Connection Timeout**
   - Check firewall rules for port 587
   - Verify SMTP_HOST is correct
   - Try alternative port 25 if 587 is blocked

3. **TLS/SSL Errors**
   - Office 365 requires TLS 1.2 or higher
   - Keep SMTP_SECURE=false for STARTTLS on port 587
   - Set SMTP_SECURE=true only for port 465 (not recommended)

4. **Emails Not Received**
   - Check spam/junk folders
   - Verify SPF records for cpowerenergy.com
   - Check Office 365 message trace logs

### Email Flow

1. **Dispatch Event Received** → Parser extracts facility information
2. **Scheduler Triggered** → Waits 10 minutes after event start
3. **Portal Automation** → Screenshots captured for each facility
4. **Contact Lookup** → Excel file provides facility contacts
5. **Email Generation** → HTML email with screenshots
6. **SMTP Delivery** → Uses configured SMTP settings

### Important Environment Variables

```env
# Required for email functionality
SMTP_HOST          # SMTP server address
SMTP_PORT          # SMTP port (usually 587)
SMTP_SECURE        # true for SSL, false for STARTTLS
SMTP_USER          # Full email address for authentication
SMTP_PASSWORD      # Password or app password

# Testing
TEST_EMAIL         # Redirects all emails to this address when set

# Portal access (for screenshots)
PORTAL_URL         # CPower portal URL
PORTAL_USERNAME    # Portal login username
PORTAL_PASSWORD    # Portal login password
```

## Security Considerations

1. Never commit `.env` files to version control
2. Use app passwords instead of regular passwords when possible
3. Rotate credentials regularly
4. Monitor email sending logs for anomalies
5. Keep TEST_EMAIL configured for non-production environments

## Running Commands

When running test scripts or the main application:

```bash
# For TypeScript files with transpile-only mode (skips type checking)
TS_NODE_TRANSPILE_ONLY=true npx ts-node [script-path]

# For production (build first)
npm run build
npm start

# For development
npm run dev
```
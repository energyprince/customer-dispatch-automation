# Email Migration Guide: Gmail to Microsoft 365

## Overview

This guide documents the process of migrating the CPower dispatch automation system from using Gmail (lightsaber874@gmail.com) to Microsoft 365 with a custom domain email address (northeast@cpowerenergy.com).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [DNS Configuration in Route 53](#dns-configuration-in-route-53)
3. [Microsoft 365 Setup](#microsoft-365-setup)
4. [Application Configuration Updates](#application-configuration-updates)
5. [Testing Plan](#testing-plan)
6. [Migration Steps](#migration-steps)
7. [Rollback Plan](#rollback-plan)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [Migration Checklist](#migration-checklist)

## Prerequisites

Before beginning the migration, ensure you have:

- [ ] Admin access to Microsoft 365 tenant
- [ ] Admin access to AWS Route 53
- [ ] Access to the cpowerenergy.com domain zone in Route 53
- [ ] Microsoft 365 license for northeast@cpowerenergy.com
- [ ] Current Gmail credentials backed up
- [ ] Test environment for validation

## DNS Configuration in Route 53

### Step 1: Access Route 53

1. Log into AWS Console
2. Navigate to Route 53
3. Select "Hosted zones"
4. Click on "cpowerenergy.com"

### Step 2: Add Required DNS Records

Add the following records to enable email functionality:

#### MX Record
```
Record name: (leave blank for root domain)
Record type: MX
Value: 0 cpowerenergy-com.mail.protection.outlook.com
TTL: 3600
```

**Note**: Replace "cpowerenergy-com" with your actual Microsoft 365 tenant name if different.

#### SPF Record
```
Record name: (leave blank for root domain)
Record type: TXT
Value: "v=spf1 include:spf.protection.outlook.com -all"
TTL: 3600
```

#### Autodiscover CNAME
```
Record name: autodiscover
Record type: CNAME
Value: autodiscover.outlook.com
TTL: 3600
```

#### DKIM Records (Optional but Recommended)
Microsoft 365 will provide two CNAME records for DKIM:
```
Record name: selector1._domainkey
Record type: CNAME
Value: selector1-cpowerenergy-com._domainkey.cpowerenergy.onmicrosoft.com

Record name: selector2._domainkey
Record type: CNAME
Value: selector2-cpowerenergy-com._domainkey.cpowerenergy.onmicrosoft.com
```

## Microsoft 365 Setup

### Step 1: Create/Verify User Account

1. Log into Microsoft 365 Admin Center
2. Navigate to Users > Active users
3. Ensure northeast@cpowerenergy.com exists and is licensed
4. Reset password if needed

### Step 2: Enable SMTP Authentication

1. In Admin Center, go to Users > Active users
2. Select northeast@cpowerenergy.com
3. Go to Mail tab
4. Under Email apps, ensure "Authenticated SMTP" is enabled

### Step 3: Create App Password (if MFA is enabled)

1. User signs into https://mysignins.microsoft.com
2. Security info > Add method > App password
3. Generate password for "Email Automation"
4. Save this password securely - it cannot be retrieved later

### Step 4: Verify SMTP Settings

Microsoft 365 SMTP Configuration:
```
Server: smtp.office365.com
Port: 587
Encryption: STARTTLS
Authentication: LOGIN
Username: northeast@cpowerenergy.com
Password: [regular password or app password]
```

Microsoft 365 IMAP Configuration:
```
Server: outlook.office365.com
Port: 993
Encryption: SSL/TLS
Username: northeast@cpowerenergy.com
Password: [regular password or app password]
```

## Application Configuration Updates

### Step 1: Update Environment Variables

Edit `.env` file:

```env
# Email monitoring configuration (IMAP)
EMAIL_USER="northeast@cpowerenergy.com"
EMAIL_PASSWORD="[app_password_here]"
EMAIL_HOST="outlook.office365.com"
EMAIL_PORT=993

# Email sending configuration (SMTP)
SMTP_HOST="smtp.office365.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="northeast@cpowerenergy.com"
SMTP_PASSWORD="[app_password_here]"

# Optional: Add these for clarity
EMAIL_FROM="northeast@cpowerenergy.com"
EMAIL_FROM_NAME="CPower Northeast"
```

### Step 2: Update Email Sender Service

If needed, update `src/services/emailSender.ts` to ensure proper "from" address:

```typescript
// In createTransporter method, ensure auth uses LOGIN
const transporter = nodemailer.createTransport({
  host: this.config.host,
  port: this.config.port,
  secure: false,
  auth: {
    user: this.config.user,
    pass: this.config.password
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

// In sendEmail method, update from address
const mailOptions = {
  from: '"CPower Northeast" <northeast@cpowerenergy.com>',
  // ... rest of options
};
```

### Step 3: Update Email Monitor Service

No changes needed if IMAP settings are correctly configured in .env

## Testing Plan

### Phase 1: DNS Verification (Day 1)

1. Wait 1-4 hours for DNS propagation
2. Verify MX records:
   ```bash
   nslookup -type=mx cpowerenergy.com
   ```
3. Test email delivery manually by sending to northeast@cpowerenergy.com

### Phase 2: SMTP Testing (Day 1-2)

1. Create test script `test-microsoft-smtp.ts`:
   ```typescript
   import * as nodemailer from 'nodemailer';
   
   async function testSMTP() {
     const transporter = nodemailer.createTransport({
       host: 'smtp.office365.com',
       port: 587,
       secure: false,
       auth: {
         user: 'northeast@cpowerenergy.com',
         pass: process.env.SMTP_PASSWORD
       }
     });
     
     try {
       await transporter.verify();
       console.log('SMTP connection successful');
       
       // Send test email
       const info = await transporter.sendMail({
         from: '"Test" <northeast@cpowerenergy.com>',
         to: 'your-test-email@example.com',
         subject: 'SMTP Test',
         text: 'This is a test email from Microsoft 365'
       });
       
       console.log('Test email sent:', info.messageId);
     } catch (error) {
       console.error('SMTP test failed:', error);
     }
   }
   
   testSMTP();
   ```

2. Run the test:
   ```bash
   npx ts-node test-microsoft-smtp.ts
   ```

### Phase 3: IMAP Testing (Day 2)

1. Update `test-email-monitor.ts` with new credentials
2. Test connection and email retrieval
3. Verify dispatch email parsing still works

### Phase 4: Integration Testing (Day 2-3)

1. Send test dispatch email to northeast@cpowerenergy.com
2. Verify email monitor detects it
3. Verify screenshot capture works
4. Verify notification emails are sent correctly

## Migration Steps

### Day 1: Preparation
1. [ ] Backup current .env file
2. [ ] Document current Gmail credentials
3. [ ] Verify Microsoft 365 access
4. [ ] Create app password if using MFA

### Day 2: DNS Changes
1. [ ] Add MX records to Route 53
2. [ ] Add SPF record
3. [ ] Add Autodiscover CNAME
4. [ ] Wait for propagation (1-4 hours)
5. [ ] Verify DNS records

### Day 3: Application Updates
1. [ ] Update .env with Microsoft 365 credentials
2. [ ] Test SMTP connection
3. [ ] Test IMAP connection
4. [ ] Run integration tests

### Day 4: Cutover
1. [ ] Stop email monitor service
2. [ ] Deploy updated configuration
3. [ ] Start services with new config
4. [ ] Monitor logs for errors
5. [ ] Send test dispatch email
6. [ ] Verify end-to-end flow

## Rollback Plan

If issues arise, rollback by:

1. **Immediate Rollback** (< 5 minutes):
   ```bash
   # Restore original .env file
   cp .env.backup .env
   
   # Restart services
   npm run restart
   ```

2. **DNS Rollback** (if needed):
   - Remove/modify MX records to point back to Gmail
   - Note: DNS changes take 1-4 hours to propagate

3. **Keep Gmail Active**:
   - Don't delete Gmail credentials immediately
   - Keep both systems running in parallel initially

## Troubleshooting

### Common Issues and Solutions

#### 1. Authentication Failures
**Error**: "535 5.7.3 Authentication unsuccessful"
**Solution**: 
- Verify app password is correct
- Ensure SMTP auth is enabled in Microsoft 365
- Check if account is locked or has conditional access policies

#### 2. Connection Timeouts
**Error**: "Connection timeout"
**Solution**:
- Verify firewall allows outbound 587/993
- Test with telnet: `telnet smtp.office365.com 587`
- Check security groups if running in AWS

#### 3. Certificate Errors
**Error**: "Self signed certificate in certificate chain"
**Solution**:
- Add to email sender config:
  ```javascript
  tls: {
    rejectUnauthorized: false
  }
  ```

#### 4. Email Not Received
**Check**:
- DNS propagation complete
- SPF record is correct
- Email not in spam/junk folder
- Microsoft 365 message trace

### Diagnostic Commands

```bash
# Check MX records
dig MX cpowerenergy.com

# Test SMTP connection
openssl s_client -connect smtp.office365.com:587 -starttls smtp

# Test IMAP connection  
openssl s_client -connect outlook.office365.com:993

# Check DNS propagation
nslookup cpowerenergy.com 8.8.8.8
```

## Security Considerations

1. **App Passwords**:
   - Use app-specific passwords when MFA is enabled
   - Store securely in environment variables
   - Rotate regularly (every 90 days)

2. **Email Authentication**:
   - SPF record prevents spoofing
   - Consider implementing DKIM
   - Add DMARC policy for reporting

3. **Access Control**:
   - Limit who can access northeast@cpowerenergy.com
   - Use conditional access policies if needed
   - Monitor sign-in logs

4. **Encryption**:
   - Always use TLS for SMTP/IMAP
   - Don't disable certificate validation in production

## Migration Checklist

### Pre-Migration
- [ ] Microsoft 365 account created and licensed
- [ ] App password generated (if using MFA)
- [ ] Current system backed up
- [ ] Test environment prepared
- [ ] Stakeholders notified of migration window

### DNS Configuration
- [ ] MX record added
- [ ] SPF record added
- [ ] Autodiscover CNAME added
- [ ] DNS propagation verified

### Application Updates
- [ ] .env file updated
- [ ] SMTP connection tested
- [ ] IMAP connection tested
- [ ] Email sending tested
- [ ] Email monitoring tested

### Post-Migration
- [ ] End-to-end flow tested
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Team trained on new setup
- [ ] Old credentials secured/removed

### Follow-up (1 week later)
- [ ] Review email delivery reports
- [ ] Check for any bounced emails
- [ ] Verify no dispatch emails missed
- [ ] Document any issues encountered

## Support Resources

- **Microsoft 365 Admin Center**: https://admin.microsoft.com
- **AWS Route 53 Console**: https://console.aws.amazon.com/route53
- **Microsoft Email Troubleshooting**: https://aka.ms/emailtroubleshooting
- **SMTP Testing Tool**: https://www.smtper.net

## Conclusion

This migration enables professional email communication using the cpowerenergy.com domain while maintaining all existing automation functionality. The process typically takes 2-3 days including testing and validation.

For questions or issues during migration, contact your system administrator or refer to the troubleshooting section above.
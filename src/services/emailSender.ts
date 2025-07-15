import nodemailer from 'nodemailer';
import { Contact, DispatchEvent } from '../types';
import * as fs from 'fs/promises';

export class EmailSender {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || ''
      }
    });
  }

  async sendDispatchNotification(
    contact: Contact,
    event: DispatchEvent,
    facility: string,
    screenshotPath?: string
  ): Promise<void> {
    try {
      const attachments: any[] = [];
      
      if (screenshotPath) {
        const screenshotExists = await fs.access(screenshotPath).then(() => true).catch(() => false);
        if (screenshotExists) {
          attachments.push({
            filename: `${facility.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-usage.png`,
            path: screenshotPath,
            cid: 'usage-screenshot'
          });
        }
      }

      const emailHtml = this.generateEmailHtml(contact, event, facility, !!screenshotPath);

      const mailOptions = {
        from: `"L.R.U" <${process.env.SMTP_USER}>`,
        to: contact.email,
        subject: `THIS MESSAGE WAS SENT BY LEO'S ROBOT UNDERLING`,
        html: emailHtml,
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✓ Email sent to ${contact.email} for ${facility}:`, info.messageId);
      
    } catch (error) {
      console.error(`✗ Failed to send email to ${contact.email} for ${facility}:`, (error as Error).message);
      throw error;
    }
  }

  private generateEmailHtml(contact: Contact, event: DispatchEvent, facility: string, hasScreenshot: boolean): string {
    const contactName = contact.firstName || 'Team';
    const eventDate = new Date(event.startTime).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: this.normalizeTimezone(event.timezone) || process.env.TZ || 'America/New_York',
      timeZoneName: 'short'
    });

    const eventEndTime = new Date(event.endTime).toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      timeZone: this.normalizeTimezone(event.timezone) || process.env.TZ || 'America/New_York',
      timeZoneName: 'short'
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF5400; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
          .facility-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #3498db; }
          .screenshot { margin: 20px 0; text-align: center; }
          .screenshot img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 5px; }
          .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Energy Usage Update - 10 Minutes Into Event</h2>
          </div>
          <div class="content">
            <p>Hey ${contactName}! 👋</p>
            
            <p>Just wanted to give you a quick update on how <strong>${facility}</strong> is doing 10 minutes into the ${event.dispatchType || 'curtailment'} event.</p>
            
            <div class="facility-info">
              <h3>Event Details:</h3>
              <p><strong>Facility:</strong> ${facility}</p>
              <p><strong>Event Type:</strong> ${event.dispatchType || 'Curtailment'}</p>
              <p><strong>Start Time:</strong> ${eventDate}</p>
              <p><strong>End Time:</strong> ${eventEndTime}</p>
            </div>
            
            ${hasScreenshot ? `
            <div class="screenshot">
              <h3>Current Energy Usage:</h3>
              <img src="cid:usage-screenshot" alt="Current energy usage for ${facility}" />
            </div>
            ` : `
            <p><em>Note: We were unable to capture the usage screenshot for this facility. You may want to check the portal directly.</em></p>
            `}
            
            <p>This is an automated notification to help you monitor your facility's performance during the event. If you have any questions or concerns, please don't hesitate to reach out.</p>
            
            <p>Best regards,<br>
            Energy Management Team</p>
          </div>
          <div class="footer">
            <p>This email was sent automatically by CPower Energy.<br>
            To update your contact preferences, please contact your Account Manager or (844)-276-9371.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('✓ SMTP connection verified successfully');
      return true;
    } catch (error) {
      console.error('✗ SMTP connection failed:', (error as Error).message);
      return false;
    }
  }

  async sendTestEmail(testEmail: string): Promise<void> {
    const testContact: Contact = {
      email: testEmail,
      firstName: 'Test',
      lastName: 'User',
      facility: 'Test Facility',
      company: 'Test Company',
      dispatchable: true
    };

    const testEvent: DispatchEvent = {
      messageId: 'test-message-id',
      subject: 'Test Dispatch Event',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      endTime: new Date(Date.now() + 50 * 60 * 1000), // 50 minutes from now
      timezone: 'America/New_York',
      facilities: [{
        companyName: 'Test Company',
        facilityName: 'Test Facility',
        address: '123 Test St',
        accountNumber: 'TEST-123',
        dispatchTarget: '500 kW'
      }],
      rawContent: 'Test email content'
    };

    await this.sendDispatchNotification(testContact, testEvent, 'Test Facility');
  }

  private normalizeTimezone(tz?: string): string {
    if (!tz) return 'America/New_York';
    
    // Convert common abbreviations to IANA timezones
    const tzMap: Record<string, string> = {
      'EDT': 'America/New_York',
      'EST': 'America/New_York',
      'CDT': 'America/Chicago',
      'CST': 'America/Chicago',
      'MDT': 'America/Denver',
      'MST': 'America/Denver',
      'PDT': 'America/Los_Angeles',
      'PST': 'America/Los_Angeles'
    };
    
    return tzMap[tz.toUpperCase()] || tz;
  }
}

import * as dotenv from 'dotenv';
import { EmailSender } from '../../services/emailSender';
import { DispatchEvent, Contact } from '../../types';

dotenv.config();

async function testEmailOnly() {
  console.log('=== Testing Email Service Only ===\n');

  const emailSender = new EmailSender();

  try {
    console.log('1. Testing SMTP connection...');
    const connected = await emailSender.testConnection();
    
    if (!connected) {
      console.error('❌ SMTP connection failed. Check your credentials.');
      return;
    }

    const testEmail = process.env.TEST_EMAIL;
    if (!testEmail) {
      console.error('❌ TEST_EMAIL not set in .env file');
      return;
    }

    console.log('\n2. Creating test dispatch event...');
    
    const testEvent: DispatchEvent = {
      messageId: 'aaron-test-123',
      subject: 'National Grid Targeted Dispatch Event',
      from: 'dispatch@cpower.com',
      dispatchType: 'Targeted Dispatch',
      eventDate: new Date(),
      startTime: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
      endTime: new Date(Date.now() + 50 * 60 * 1000), // 50 minutes from now
      timezone: 'EDT', // This will be normalized to America/New_York
      facilities: [{
        companyName: 'Aaron Industries Corp.',
        facilityName: 'Aaron Industries Leominster MA',
        address: '34 Simon Road, Leominster MA',
        accountNumber: 'AARON-LEO-001',
        dispatchTarget: 'NGRID Zone'
      }],
      rawContent: 'Test dispatch content'
    };

    const testContact: Contact = {
      email: testEmail,
      firstName: 'Test',
      lastName: 'Recipient',
      facility: 'Aaron Industries Leominster MA',
      company: 'Aaron Industries Corp.',
      dispatchable: true
    };

    console.log('\n3. Sending test email...');
    console.log(`   To: ${testEmail}`);
    console.log(`   Facility: ${testContact.facility}`);
    console.log(`   Event Type: ${testEvent.dispatchType}`);
    
    await emailSender.sendDispatchNotification(
      testContact, 
      testEvent, 
      'Aaron Industries Leominster MA'
    );
    
    console.log('\n✅ Email sent successfully!');
    console.log('   Check your inbox for the dispatch notification.');

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error(error);
  }
}

testEmailOnly();
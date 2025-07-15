import * as dotenv from 'dotenv';
import { EmailSender } from '../../services/emailSender';

dotenv.config();

async function testEmailSender() {
  console.log('=== Testing Email Sender Service ===\n');

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

    console.log('\n2. Sending test email...');
    console.log(`   To: ${testEmail}`);
    
    await emailSender.sendTestEmail(testEmail);
    
    console.log('\n✅ Email sent successfully!');
    console.log('   Check your inbox for the test dispatch notification.');

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
  }
}

testEmailSender();
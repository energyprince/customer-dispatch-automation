import * as dotenv from 'dotenv';
import * as path from 'path';
import { CPowerEmailParser } from '../../services/cpowerEmailParser';
import { Scheduler } from '../../services/scheduler';

dotenv.config();

async function testAaronSafe() {
  console.log('=== Testing Aaron Industries (Safe Mode - Test Email Only) ===\n');

  if (!process.env.TEST_EMAIL) {
    console.error('❌ TEST_EMAIL not set in .env file');
    console.error('   This safety test requires TEST_EMAIL to redirect all emails');
    return;
  }

  console.log(`✅ All emails will be sent to: ${process.env.TEST_EMAIL}\n`);

  const parser = new CPowerEmailParser();
  const scheduler = new Scheduler();

  try {
    console.log('1. Initializing scheduler...');
    await scheduler.initialize();

    const emailPath = path.join(
      process.cwd(),
      'data',
      'Dispatched Event Internal Notification for_ National Grid Targeted Dispatch Event - Tuesday, June 24, 2025.eml'
    );

    console.log('\n2. Parsing dispatch email...');
    const dispatchEvent = await parser.parseEmailFile(emailPath);

    if (!dispatchEvent) {
      console.error('❌ Failed to parse dispatch email');
      return;
    }

    // Find Aaron Industries
    const aaronFacility = dispatchEvent.facilities.find(f => 
      f.facilityName.toLowerCase().includes('aaron')
    );

    if (!aaronFacility) {
      console.error('❌ Aaron Industries not found');
      return;
    }

    console.log(`   ✓ Found: ${aaronFacility.facilityName}`);
    console.log(`   Company: ${aaronFacility.companyName}`);
    console.log(`   Target: ${aaronFacility.dispatchTarget}`);

    // Use actual event times from the parsed email (June 24, 2025 5:00 PM - 8:00 PM)
    // Since this is a past event, it will process immediately
    const testEvent = {
      ...dispatchEvent,
      facilities: [aaronFacility] // Only process Aaron Industries
    };

    console.log('\n3. Processing dispatch event...');
    console.log(`   Event Date: ${dispatchEvent.eventDate.toLocaleDateString()}`);
    console.log(`   Event Time: ${dispatchEvent.startTime.toLocaleTimeString()} - ${dispatchEvent.endTime.toLocaleTimeString()}`);
    console.log('   Real contact data will be used but emails redirected to test address');

    // Listen to events
    scheduler.on('jobStarted', (data) => {
      console.log(`\n🏃 Processing ${data.facilityName}...`);
    });

    scheduler.on('jobCompleted', (data) => {
      console.log(`\n✅ Successfully processed ${data.facilityName}`);
      console.log(`   Emails sent to: ${process.env.TEST_EMAIL}`);
      console.log('\nTest completed! Check your test inbox.');
      setTimeout(() => process.exit(0), 1000);
    });

    scheduler.on('jobFailed', (data) => {
      console.log(`\n❌ Failed to process ${data.facilityName}`);
      setTimeout(() => process.exit(1), 1000);
    });

    scheduler.on('noContactsFound', (data) => {
      console.log(`⚠️  No contacts found for ${data.facilityName}`);
    });

    scheduler.on('emailFailed', (data) => {
      console.log(`   ✗ Email failed: ${data.contact.email}`);
    });

    // This should process immediately since event is in the past
    scheduler.scheduleDispatchNotifications(testEvent);

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error(error);
  }
}

testAaronSafe();
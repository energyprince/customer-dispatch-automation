import * as dotenv from 'dotenv';
import * as path from 'path';
import { CPowerEmailParser } from '../../services/cpowerEmailParser';
import { Scheduler } from '../../services/scheduler';

dotenv.config();

async function testAaronNow() {
  console.log('=== Testing Aaron Industries - Immediate Processing ===\n');

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

    // Create event that already started (immediate processing)
    const testEvent = {
      ...dispatchEvent,
      startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      facilities: [aaronFacility] // Only Aaron Industries
    };

    console.log('\n3. Processing immediately (event already started)...');

    // Listen to events
    scheduler.on('jobStarted', (data) => {
      console.log(`\n🏃 Processing ${data.facilityName}...`);
    });

    scheduler.on('jobCompleted', (data) => {
      console.log(`✅ Successfully processed ${data.facilityName}`);
      console.log('\nDone! Check email inbox for notification.');
      setTimeout(() => process.exit(0), 1000);
    });

    scheduler.on('jobFailed', (data) => {
      console.log(`❌ Failed to process ${data.facilityName}`);
      setTimeout(() => process.exit(1), 1000);
    });

    scheduler.on('noContactsFound', (data) => {
      console.log(`⚠️  No contacts found for ${data.facilityName}`);
    });

    scheduler.on('emailFailed', (data) => {
      console.log(`⚠️  Email failed: ${data.contact.email}`);
    });

    // This should process immediately since event is in the past
    scheduler.scheduleDispatchNotifications(testEvent);

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error(error);
  }
}

testAaronNow();
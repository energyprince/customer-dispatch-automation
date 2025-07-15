import * as dotenv from 'dotenv';
import * as path from 'path';
import { CPowerEmailParser } from '../../services/cpowerEmailParser';
import { Scheduler } from '../../services/scheduler';
import { ExcelService } from '../../services/excelService';

dotenv.config();

async function testAaronIndustries() {
  console.log('=== Testing Aaron Industries Dispatch ===\n');

  const parser = new CPowerEmailParser();
  const scheduler = new Scheduler();
  const excelService = new ExcelService();

  try {
    console.log('1. Loading services...');
    await scheduler.initialize();
    await excelService.initialize();

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

    console.log('   ✓ Dispatch parsed successfully');
    console.log(`   Event Type: ${dispatchEvent.dispatchType}`);
    console.log(`   Start Time: ${dispatchEvent.startTime.toLocaleString()}`);
    console.log(`   Facilities: ${dispatchEvent.facilities.length}`);

    // Find Aaron Industries
    const aaronIndustriesFacility = dispatchEvent.facilities.find(f => 
      f.facilityName.toLowerCase().includes('aaron')
    );

    if (!aaronIndustriesFacility) {
      console.error('❌ Aaron Industries not found in dispatch');
      return;
    }

    console.log(`\n3. Found facility: ${aaronIndustriesFacility.facilityName}`);

    // Check contacts
    const contacts = excelService.getContactsByFacility(aaronIndustriesFacility.facilityName);
    console.log(`   Contacts found: ${contacts.length}`);
    
    if (contacts.length > 0) {
      console.log('   Contact details:');
      contacts.forEach(contact => {
        console.log(`   - ${contact.firstName} ${contact.lastName} (${contact.email})`);
      });
    } else {
      // Try fuzzy match
      const match = excelService.findBestMatch(aaronIndustriesFacility.facilityName);
      if (match) {
        console.log(`   Fuzzy match found: ${match.facility} (${Math.round(match.confidence * 100)}% confidence)`);
      }
    }

    // Create a test event that starts soon (for testing)
    const testEvent = {
      ...dispatchEvent,
      startTime: new Date(Date.now() + 30 * 1000), // 30 seconds from now
      endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      facilities: [aaronIndustriesFacility] // Only process Aaron Industries
    };

    console.log('\n4. Scheduling notification for Aaron Industries...');
    console.log(`   Notification will be sent at: ${new Date(testEvent.startTime.getTime() + 10 * 60 * 1000).toLocaleTimeString()}`);

    // Listen to scheduler events
    scheduler.on('jobScheduled', (data) => {
      console.log(`   ✓ Job scheduled for ${data.facilityName}`);
    });

    scheduler.on('jobStarted', (data) => {
      console.log(`\n🏃 Processing ${data.facilityName}...`);
    });

    scheduler.on('jobCompleted', (data) => {
      console.log(`✅ Successfully processed ${data.facilityName}`);
      console.log('\nTest completed! Check the email inbox for the notification.');
      process.exit(0);
    });

    scheduler.on('jobFailed', (data) => {
      console.log(`❌ Failed to process ${data.facilityName}`);
      process.exit(1);
    });

    scheduler.on('noContactsFound', (data) => {
      console.log(`⚠️  No contacts found for ${data.facilityName}`);
    });

    scheduler.scheduleDispatchNotifications(testEvent);

    console.log('\n⏰ Waiting for scheduled job to execute...');
    console.log('   (This will take about 40 seconds)');
    console.log('   Press Ctrl+C to cancel\n');

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\n\nCancelling...');
      scheduler.cancelAllJobs();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error(error);
  }
}

testAaronIndustries();
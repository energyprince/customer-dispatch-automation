import * as dotenv from 'dotenv';
import { Scheduler } from '../../services/scheduler';
import { DispatchEvent } from '../../types';

dotenv.config();

async function testScheduler() {
  console.log('=== Testing Scheduler Service ===\n');

  const scheduler = new Scheduler();

  try {
    console.log('1. Initializing scheduler...');
    await scheduler.initialize();

    // Create a test event that starts in 1 minute
    const testEvent: DispatchEvent = {
      messageId: 'test-scheduler-123',
      subject: 'Test Scheduler Dispatch',
      from: 'test@cpower.com',
      dispatchType: 'Targeted Dispatch',
      eventDate: new Date(),
      startTime: new Date(Date.now() + 60 * 1000), // 1 minute from now
      endTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      timezone: 'America/New_York',
      facilities: [
        {
          companyName: 'Aaron Industries Inc',
          facilityName: 'Aaron Industries',
          address: '123 Industrial Ave',
          accountNumber: 'AARON-123',
          dispatchTarget: '500 kW'
        },
        {
          companyName: 'Test Company',
          facilityName: 'Test Facility 2',
          address: '456 Test St',
          accountNumber: 'TEST-456',
          dispatchTarget: '250 kW'
        }
      ],
      rawContent: 'Test scheduler dispatch'
    };

    // Listen to scheduler events
    scheduler.on('jobScheduled', (data) => {
      console.log(`   ✓ Job scheduled: ${data.facilityName} at ${data.scheduledTime.toLocaleTimeString()}`);
    });

    scheduler.on('jobStarted', (data) => {
      console.log(`   ▶ Job started: ${data.facilityName}`);
    });

    scheduler.on('noContactsFound', (data) => {
      console.log(`   ⚠ No contacts found: ${data.facilityName}`);
    });

    scheduler.on('jobCompleted', (data) => {
      console.log(`   ✓ Job completed: ${data.facilityName}`);
    });

    scheduler.on('jobFailed', (data) => {
      console.log(`   ✗ Job failed: ${data.facilityName}`);
    });

    console.log('\n2. Scheduling test dispatch notifications...');
    console.log(`   Event starts at: ${testEvent.startTime.toLocaleTimeString()}`);
    console.log(`   Notifications at: ${new Date(testEvent.startTime.getTime() + 10 * 60 * 1000).toLocaleTimeString()}`);
    
    scheduler.scheduleDispatchNotifications(testEvent);

    console.log('\n3. Active jobs:');
    const activeJobs = scheduler.getActiveJobs();
    activeJobs.forEach(job => {
      console.log(`   - ${job.facilityName}: ${job.status} (scheduled for ${job.scheduledTime.toLocaleTimeString()})`);
    });

    console.log('\n4. Job statistics:');
    const stats = scheduler.getStatistics();
    console.log(`   Pending: ${stats.pending}`);
    console.log(`   Running: ${stats.running}`);
    console.log(`   Completed: ${stats.completed}`);
    console.log(`   Failed: ${stats.failed}`);

    console.log('\n⏰ Waiting for scheduled jobs to execute...');
    console.log('   (This will take about 70 seconds)');
    console.log('   Press Ctrl+C to cancel\n');

    // Keep the process alive to let scheduled jobs run
    process.on('SIGINT', () => {
      console.log('\n\nCancelling all jobs...');
      scheduler.cancelAllJobs();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
  }
}

testScheduler();
import * as dotenv from 'dotenv';
import { EmailMonitor } from '../../services/emailMonitor';
import { ProcessedEmailTracker } from '../../services/processedTracker';
import { Scheduler } from '../../services/scheduler';

dotenv.config();

async function testIntegration() {
  console.log('=== Testing Phase 3 Integration ===\n');
  console.log('This test will monitor emails and automatically schedule notifications.\n');

  const tracker = new ProcessedEmailTracker();
  const monitorConfig = {
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    host: process.env.EMAIL_HOST || 'imap.gmail.com',
    port: 993,
    tls: true,
    checkInterval: 30000
  };
  const monitor = new EmailMonitor(monitorConfig, tracker);
  const scheduler = new Scheduler();

  try {
    console.log('1. Initializing services...');
    await scheduler.initialize();
    console.log('   ✓ Scheduler initialized');

    // Set up the integration
    monitor.on('dispatch', async (event) => {
      console.log('\n📧 Dispatch event received!');
      console.log(`   Subject: ${event.subject}`);
      console.log(`   Facilities: ${event.facilities.length}`);
      console.log(`   Event Start: ${event.startTime.toLocaleString()}`);
      
      // Schedule notifications for 10 minutes after event start
      scheduler.scheduleDispatchNotifications(event);
    });

    // Monitor scheduler events
    scheduler.on('jobScheduled', (data) => {
      console.log(`   📅 Scheduled: ${data.facilityName}`);
    });

    scheduler.on('jobStarted', (data) => {
      console.log(`\n🏃 Processing: ${data.facilityName}`);
    });

    scheduler.on('jobCompleted', (data) => {
      console.log(`   ✓ Completed: ${data.facilityName}`);
    });

    scheduler.on('noContactsFound', (data) => {
      console.log(`   ⚠ No contacts: ${data.facilityName}`);
    });

    scheduler.on('emailFailed', (data) => {
      console.log(`   ✗ Email failed for ${data.contact.email}`);
    });

    console.log('\n2. Connecting to email server...');
    await monitor.connect();

    console.log('\n3. Starting email monitoring...');
    console.log('   Checking for unread dispatch emails every 30 seconds');
    console.log('   When a dispatch is found:');
    console.log('   - Extracts facility information');
    console.log('   - Schedules notifications for event start + 10 minutes');
    console.log('   - Takes screenshots and sends emails automatically\n');
    
    await monitor.startMonitoring();

    console.log('📧 Monitoring active. Waiting for dispatch emails...');
    console.log('   To test: Send a dispatch email to the monitored inbox');
    console.log('   Press Ctrl+C to stop\n');

    // Log active jobs every minute
    setInterval(() => {
      const stats = scheduler.getStatistics();
      const activeJobs = scheduler.getActiveJobs();
      
      if (stats.pending > 0 || stats.running > 0) {
        console.log(`\n📊 Status Update:`);
        console.log(`   Pending: ${stats.pending}, Running: ${stats.running}, Completed: ${stats.completed}, Failed: ${stats.failed}`);
        
        if (activeJobs.length > 0) {
          console.log('   Next job:', activeJobs[0].facilityName, 'at', activeJobs[0].scheduledTime.toLocaleTimeString());
        }
      }
    }, 60000);

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log('\n\nShutting down...');
      scheduler.cancelAllJobs();
      await monitor.disconnect();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    process.exit(1);
  }
}

testIntegration();
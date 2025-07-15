// Example usage of EmailMonitor
import { EmailMonitor, EmailMonitorConfig } from '../services/emailMonitor';
import { ProcessedEmailTracker } from '../services/processedTracker';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function demonstrateEmailMonitor() {
  console.log('=== EmailMonitor Demo ===\n');

  // Check if credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('⚠️  Email credentials not configured!');
    console.log('   Please set the following in your .env file:');
    console.log('   EMAIL_USER=your-email@example.com');
    console.log('   EMAIL_PASSWORD=your-app-password');
    console.log('   EMAIL_HOST=imap.gmail.com');
    console.log('   EMAIL_PORT=993\n');
    return;
  }

  // Configure email monitor
  const config: EmailMonitorConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: process.env.EMAIL_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '993'),
    tls: true,
    checkInterval: 10000 // Check every 10 seconds for demo
  };

  // Create tracker and monitor
  const tracker = new ProcessedEmailTracker('demo-processed-emails.json');
  const monitor = new EmailMonitor(config, tracker);

  try {
    // Initialize tracker
    await tracker.initialize();

    // Connect to email server
    console.log('1. Connecting to email server...');
    console.log(`   Host: ${config.host}`);
    console.log(`   User: ${config.user}`);
    await monitor.connect();
    
    // Get initial status
    let status = monitor.getStatus();
    console.log(`   ✓ Connected: ${status.connected}\n`);

    // Set up event listeners
    console.log('2. Setting up event listeners...');
    
    monitor.on('dispatch', (dispatchEvent) => {
      console.log('\n🚨 DISPATCH EVENT DETECTED!');
      console.log(`   Type: ${dispatchEvent.dispatchType}`);
      console.log(`   Date: ${dispatchEvent.eventDate.toLocaleDateString()}`);
      console.log(`   Start: ${dispatchEvent.startTime.toLocaleTimeString()}`);
      console.log(`   End: ${dispatchEvent.endTime.toLocaleTimeString()}`);
      console.log(`   Facilities: ${dispatchEvent.facilities.length}`);
      
      // Show first 3 facilities
      console.log('\n   First 3 facilities:');
      dispatchEvent.facilities.slice(0, 3).forEach((facility, index) => {
        console.log(`   ${index + 1}. ${facility.facilityName} (${facility.companyName})`);
      });
      
      console.log('\n   📧 This event would trigger notifications to all facility contacts!');
    });

    // Check for emails immediately
    console.log('\n3. Checking for emails now...');
    await monitor.checkNow();

    // Start monitoring
    console.log('\n4. Starting continuous monitoring...');
    console.log(`   Checking every ${config.checkInterval / 1000} seconds`);
    await monitor.startMonitoring();
    
    status = monitor.getStatus();
    console.log(`   ✓ Monitoring: ${status.monitoring}`);

    // Show what's happening
    console.log('\n5. Monitor is now running!');
    console.log('   - Watching for unread emails');
    console.log('   - Looking for CPower dispatch emails');
    console.log('   - Will emit "dispatch" event when found');
    console.log('   - Marks processed emails to avoid duplicates');
    
    // Show tracker stats
    const trackerStats = tracker.getStats();
    console.log(`\n6. Processed Email Tracker:`);
    console.log(`   Total processed: ${trackerStats.total}`);

    // Run for 30 seconds then stop
    console.log('\n7. Demo will run for 30 seconds...');
    console.log('   (In production, this would run continuously)');
    
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Stop monitoring
    console.log('\n8. Stopping monitor...');
    monitor.stopMonitoring();
    
    // Disconnect
    console.log('9. Disconnecting from email server...');
    await monitor.disconnect();
    
    // Final status
    status = monitor.getStatus();
    console.log(`   Connected: ${status.connected}`);
    console.log(`   Monitoring: ${status.monitoring}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    console.error('\nTroubleshooting tips:');
    console.error('- For Gmail: Enable IMAP in settings');
    console.error('- For Gmail: Use an app-specific password');
    console.error('- Check your firewall settings');
    console.error('- Verify EMAIL_HOST and EMAIL_PORT');
  } finally {
    // Clean up
    if (monitor.getStatus().connected) {
      await monitor.disconnect();
    }
  }

  console.log('\n=== Demo Complete ===');
}

// Run the demo
if (require.main === module) {
  demonstrateEmailMonitor().catch(console.error);
}
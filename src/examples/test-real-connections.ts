// Test real Gmail and Portal connections
import { EmailMonitor, EmailMonitorConfig } from '../services/emailMonitor';
import { ScreenshotService, ScreenshotConfig } from '../services/screenshotService';
import { ProcessedEmailTracker } from '../services/processedTracker';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function testConnections() {
  console.log('=== Testing Real Connections ===\n');

  // Test 1: Gmail Connection
  console.log('📧 TEST 1: Gmail IMAP Connection');
  console.log('================================');
  
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.log('❌ EMAIL_USER or EMAIL_PASSWORD not set in .env file\n');
  } else {
    const emailConfig: EmailMonitorConfig = {
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD,
      host: process.env.EMAIL_HOST || 'imap.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '993'),
      tls: true,
      checkInterval: 30000
    };

    console.log(`Connecting to: ${emailConfig.host}`);
    console.log(`User: ${emailConfig.user}`);
    console.log(`Port: ${emailConfig.port}\n`);

    const tracker = new ProcessedEmailTracker('test-connection.json');
    const monitor = new EmailMonitor(emailConfig, tracker);

    try {
      await monitor.connect();
      console.log('✅ Successfully connected to Gmail!');
      
      // Check for unread emails
      console.log('\nChecking for emails...');
      
      // Listen for dispatch events
      monitor.on('dispatch', (event) => {
        console.log('\n🚨 DISPATCH EMAIL FOUND!');
        console.log(`Type: ${event.dispatchType}`);
        console.log(`Facilities: ${event.facilities.length}`);
        console.log(`Start: ${event.startTime.toLocaleString()}`);
      });

      await monitor.checkNow();
      console.log('Email check complete.\n');
      
      await monitor.disconnect();
    } catch (error) {
      console.error('❌ Connection failed:', (error as Error).message);
      console.log('\nTroubleshooting:');
      console.log('1. Enable IMAP in Gmail settings');
      console.log('2. Use an App Password (not your regular password)');
      console.log('3. Check firewall/antivirus settings\n');
    } finally {
      await tracker.reset();
    }
  }

  // Test 2: Portal Connection
  console.log('\n🌐 TEST 2: Portal Website Connection');
  console.log('====================================');

  if (!process.env.PORTAL_URL || !process.env.PORTAL_USERNAME || !process.env.PORTAL_PASSWORD) {
    console.log('❌ PORTAL_URL, PORTAL_USERNAME, or PORTAL_PASSWORD not set in .env file\n');
  } else {
    const screenshotConfig: ScreenshotConfig = {
      portalUrl: process.env.PORTAL_URL,
      username: process.env.PORTAL_USERNAME,
      password: process.env.PORTAL_PASSWORD,
      headless: false, // Show browser so you can see what's happening
      timeout: 60000  // 60 seconds for manual intervention if needed
    };

    console.log(`Portal URL: ${screenshotConfig.portalUrl}`);
    console.log(`Username: ${screenshotConfig.username}`);
    console.log(`Headless: ${screenshotConfig.headless} (browser will be visible)\n`);

    const screenshotService = new ScreenshotService(screenshotConfig);

    try {
      console.log('Launching browser...');
      await screenshotService.initialize();
      console.log('✅ Browser launched\n');

      console.log('Attempting login...');
      console.log('(You can watch the browser and help if needed)\n');
      
      await screenshotService.login();
      console.log('✅ Successfully logged in!\n');

      // Ask user to confirm we're on the right page
      const status = screenshotService.getStatus();
      console.log(`Current URL: ${status.url}\n`);
      
      const proceed = await question('Does the portal look correct? (y/n): ');
      
      if (proceed.toLowerCase() === 'y') {
        // Test searching for a facility
        const facilityName = await question('\nEnter a facility name to search for: ');
        
        if (facilityName) {
          console.log(`\nSearching for: ${facilityName}`);
          const screenshot = await screenshotService.captureUsage(facilityName);
          
          if (screenshot) {
            console.log(`✅ Screenshot saved: ${screenshot}`);
          } else {
            console.log('❌ Failed to capture screenshot');
          }
        }
      }

      console.log('\nClosing browser in 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.error('❌ Portal connection failed:', (error as Error).message);
      
      // Take debug screenshot
      const debugPath = await screenshotService.debugScreenshot('portal-error');
      if (debugPath) {
        console.log(`\nDebug screenshot saved: ${debugPath}`);
      }
      
      console.log('\nTroubleshooting:');
      console.log('1. Check the PORTAL_URL is correct');
      console.log('2. Verify username/password');
      console.log('3. The portal might have changed - check the debug screenshot');
      console.log('4. You may need to update the selectors in screenshotService.ts\n');
    } finally {
      await screenshotService.close();
    }
  }

  rl.close();
  console.log('\n=== Connection Tests Complete ===');
}

// Run the tests
if (require.main === module) {
  testConnections().catch(console.error);
}
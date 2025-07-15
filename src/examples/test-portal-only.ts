// Test only the portal connection
import { ScreenshotService, ScreenshotConfig } from '../services/screenshotService';
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

async function testPortal() {
  console.log('=== Testing CPower Portal Connection ===\n');

  const screenshotConfig: ScreenshotConfig = {
    portalUrl: process.env.PORTAL_URL!,
    username: process.env.PORTAL_USERNAME!,
    password: process.env.PORTAL_PASSWORD!,
    headless: false, // Show browser so you can see what's happening
    timeout: 60000,  // 60 seconds
    usageDataWaitTime: 50000 // Wait up to 50 seconds for usage data (Rhode Island Hospital can be slow)
  };

  console.log(`Portal URL: ${screenshotConfig.portalUrl}`);
  console.log(`Username: ${screenshotConfig.username}`);
  console.log(`Browser visible: Yes\n`);

  const screenshotService = new ScreenshotService(screenshotConfig);

  try {
    console.log('1. Launching browser...');
    await screenshotService.initialize();
    console.log('   ✅ Browser launched\n');

    console.log('2. Navigating to portal...');
    console.log('   (Watch the browser window)\n');
    
    await screenshotService.login();
    console.log('   ✅ Login successful!\n');

    const status = screenshotService.getStatus();
    console.log(`3. Current URL: ${status.url}\n`);
    
    // Test searching for a facility
    const testFacilities = [
      { facility: 'Rhode Island Hospital', contact: 'Tony Alves' },
      { facility: 'BJ\'s Wholesale Club', contact: null },
      { facility: 'Brown University', contact: null }
    ];
    
    console.log('4. Testing facility search...');
    const test = testFacilities[0];
    console.log(`   Searching for: ${test.facility}`);
    if (test.contact) {
      console.log(`   Contact person: ${test.contact}`);
    }
    
    const screenshot = await screenshotService.captureUsage(test.facility, test.contact || undefined, 'Targeted Dispatch');
    
    if (screenshot) {
      console.log(`   ✅ Screenshot saved: ${screenshot}\n`);
    } else {
      console.log('   ❌ Failed to capture screenshot\n');
    }

    // Keep browser open for manual inspection
    const keepOpen = await question('Keep browser open for inspection? (y/n): ');
    
    if (keepOpen.toLowerCase() === 'y') {
      await question('Press Enter when ready to close...');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    
    // Take debug screenshot
    try {
      const debugPath = await screenshotService.debugScreenshot('portal-error');
      if (debugPath) {
        console.log(`\nDebug screenshot saved: ${debugPath}`);
      }
    } catch (e) {
      // Ignore screenshot error
    }
    
    console.log('\nThe portal might have different login fields than expected.');
    console.log('Let\'s identify the correct selectors...\n');
    
    await question('Press Enter to close and run selector identifier...');
  } finally {
    await screenshotService.close();
    rl.close();
  }
}

// Run the test
if (require.main === module) {
  testPortal().catch(console.error);
}
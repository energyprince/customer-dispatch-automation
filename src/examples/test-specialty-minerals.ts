// Test Specialty Minerals edge case - needs Targeted Dispatch tab
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

async function testSpecialtyMinerals() {
  console.log('=== Testing Specialty Minerals (Targeted Dispatch) ===\n');

  const screenshotConfig: ScreenshotConfig = {
    portalUrl: process.env.PORTAL_URL!,
    username: process.env.PORTAL_USERNAME!,
    password: process.env.PORTAL_PASSWORD!,
    headless: false,
    timeout: 60000,
    usageDataWaitTime: 50000  // Longer wait for Specialty Minerals
  };

  console.log(`Portal URL: ${screenshotConfig.portalUrl}`);
  console.log(`Username: ${screenshotConfig.username}`);
  console.log(`Browser visible: Yes\n`);

  const screenshotService = new ScreenshotService(screenshotConfig);

  try {
    console.log('1. Launching browser...');
    await screenshotService.initialize();
    console.log('   ✅ Browser launched\n');

    console.log('2. Logging in...');
    await screenshotService.login();
    console.log('   ✅ Login successful!\n');

    const status = screenshotService.getStatus();
    console.log(`3. Current URL: ${status.url}\n`);
    
    // Test Specialty Minerals with Mitchell Cooper
    const test = {
      facility: 'Specialty Minerals Inc',
      contact: 'Mitchell Cooper',
      dispatchType: 'Targeted Dispatch'
    };
    
    console.log('4. Testing Specialty Minerals edge case...');
    console.log(`   Facility: ${test.facility}`);
    console.log(`   Contact: ${test.contact}`);
    console.log(`   Expected behavior: Should select Targeted Dispatch tab\n`);
    
    const screenshot = await screenshotService.captureUsage(
      test.facility, 
      test.contact,
      test.dispatchType
    );
    
    if (screenshot) {
      console.log(`   ✅ Screenshot saved: ${screenshot}`);
      console.log('   ✅ Successfully handled Targeted Dispatch tab!');
    } else {
      console.log('   ⚠️  No usage data found');
      console.log('   This might indicate the tab selection didn\'t work');
    }

    // Test Rhode Island Hospital for comparison
    console.log('\n5. Testing Rhode Island Hospital for comparison...');
    const rhTest = {
      facility: 'Rhode Island Hospital',
      contact: 'Tony Alves',
      dispatchType: 'RI ET'
    };
    
    console.log(`   Facility: ${rhTest.facility}`);
    console.log(`   Contact: ${rhTest.contact}`);
    console.log(`   Expected behavior: Should select base Rhode Island Hospital\n`);
    
    const rhScreenshot = await screenshotService.captureUsage(
      rhTest.facility,
      rhTest.contact,
      rhTest.dispatchType
    );
    
    if (rhScreenshot) {
      console.log(`   ✅ Screenshot saved: ${rhScreenshot}`);
    } else {
      console.log('   ⚠️  No usage data found');
    }

    // Keep browser open for inspection
    const keepOpen = await question('\nKeep browser open for inspection? (y/n): ');
    
    if (keepOpen.toLowerCase() === 'y') {
      await question('Press Enter when ready to close...');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    
    // Take debug screenshot
    try {
      const debugPath = await screenshotService.debugScreenshot('specialty-minerals-error');
      if (debugPath) {
        console.log(`\nDebug screenshot saved: ${debugPath}`);
      }
    } catch (e) {
      // Ignore screenshot error
    }
  } finally {
    await screenshotService.close();
    rl.close();
  }
}

// Run the test
if (require.main === module) {
  testSpecialtyMinerals().catch(console.error);
}
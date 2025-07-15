// Example usage of ScreenshotService
import { ScreenshotService, ScreenshotConfig } from '../services/screenshotService';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

// Load environment variables
dotenv.config();

async function demonstrateScreenshotService() {
  console.log('=== ScreenshotService Demo ===\n');

  // Check if portal credentials are configured
  if (!process.env.PORTAL_URL || !process.env.PORTAL_USERNAME || !process.env.PORTAL_PASSWORD) {
    console.log('⚠️  Portal credentials not configured!');
    console.log('   Please set the following in your .env file:');
    console.log('   PORTAL_URL=https://your-portal.com/login');
    console.log('   PORTAL_USERNAME=your-username');
    console.log('   PORTAL_PASSWORD=your-password\n');
    
    console.log('Running demo with test URL instead...\n');
  }

  // Configure screenshot service
  const config: ScreenshotConfig = {
    portalUrl: process.env.PORTAL_URL || 'https://www.example.com',
    username: process.env.PORTAL_USERNAME || 'demo-user',
    password: process.env.PORTAL_PASSWORD || 'demo-pass',
    headless: false, // Show browser for demo
    timeout: 30000,
    screenshotDir: path.join(process.cwd(), 'demo-screenshots')
  };

  const screenshotService = new ScreenshotService(config);

  try {
    // Initialize browser
    console.log('1. Initializing browser...');
    console.log(`   Headless: ${config.headless}`);
    console.log(`   Screenshot directory: ${config.screenshotDir}`);
    await screenshotService.initialize();
    
    let status = screenshotService.getStatus();
    console.log(`   ✓ Browser open: ${status.browserOpen}\n`);

    // Attempt login
    console.log('2. Attempting to login...');
    console.log(`   URL: ${config.portalUrl}`);
    
    try {
      await screenshotService.login();
      status = screenshotService.getStatus();
      console.log(`   ✓ Logged in: ${status.loggedIn}`);
      console.log(`   Current URL: ${status.url}\n`);
    } catch (error) {
      console.log('   ✗ Login failed (expected with demo URL)');
      console.log(`   Error: ${error.message}\n`);
      
      // Take debug screenshot
      const debugPath = await screenshotService.debugScreenshot('login-attempt');
      if (debugPath) {
        console.log(`   Debug screenshot saved: ${path.basename(debugPath)}\n`);
      }
    }

    // Capture screenshots for facilities
    console.log('3. Capturing facility screenshots...');
    const facilities = [
      'Rhode Island Hospital',
      'BJ\'s Wholesale Club ISONE 393',
      'Brown University 222 Richmond St'
    ];

    for (const facility of facilities) {
      console.log(`\n   Capturing: ${facility}`);
      const screenshotPath = await screenshotService.captureUsage(facility);
      
      if (screenshotPath) {
        const stats = await fs.stat(screenshotPath);
        console.log(`   ✓ Saved: ${path.basename(screenshotPath)}`);
        console.log(`   Size: ${(stats.size / 1024).toFixed(1)} KB`);
      } else {
        console.log('   ✗ Failed to capture screenshot');
      }
    }

    // Show how screenshots would be used
    console.log('\n4. In production, these screenshots would be:');
    console.log('   - Captured 10 minutes after event start');
    console.log('   - Attached to emails sent to facility contacts');
    console.log('   - Deleted after successful email delivery');

    // List all screenshots
    console.log('\n5. Screenshots captured:');
    const files = await fs.readdir(config.screenshotDir);
    const screenshots = files.filter(f => f.endsWith('.png'));
    screenshots.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });

    // Demonstrate debug features
    console.log('\n6. Debug features:');
    status = screenshotService.getStatus();
    console.log(`   Browser open: ${status.browserOpen}`);
    console.log(`   Logged in: ${status.loggedIn}`);
    console.log(`   Current URL: ${status.url}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    // Clean up
    console.log('\n7. Closing browser...');
    await screenshotService.close();
    console.log('   ✓ Browser closed');

    // Optionally clean up screenshots
    console.log('\nDemo screenshots are saved in:', config.screenshotDir);
    console.log('(Delete this directory when done reviewing)');
  }

  console.log('\n=== Demo Complete ===');
}

// Run the demo
if (require.main === module) {
  demonstrateScreenshotService().catch(console.error);
}
// Test that we can detect and validate usage data
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

async function testUsageValidation() {
  console.log('🧪 Testing Usage Data Detection\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 300
  });
  
  const page = await browser.newPage();
  
  try {
    // Login
    console.log('1. Logging in...');
    await page.goto(process.env.PORTAL_URL!);
    await page.fill('#Username', process.env.PORTAL_USERNAME!);
    await page.fill('#Password', process.env.PORTAL_PASSWORD!);
    await page.click('button:has-text("Log In")');
    await page.waitForLoadState('networkidle');
    console.log('✅ Logged in\n');
    
    // Test Rhode Island Hospital base facility
    console.log('2. Testing Rhode Island Hospital (base facility)...');
    
    // Get to dashboard
    await page.click('a:has-text("Dashboard")').catch(() => {});
    await page.waitForTimeout(2000);
    
    // Check registration dropdown
    const options = await page.$$eval('#registrationDetails option', 
      opts => opts.map(opt => ({
        value: opt.getAttribute('value'),
        text: opt.textContent
      }))
    );
    
    console.log('Available registrations:');
    options.forEach(opt => console.log(`  - ${opt.text}`));
    
    // Find and select base "Rhode Island Hospital"
    const baseOption = options.find(opt => opt.text === 'Rhode Island Hospital');
    if (baseOption) {
      console.log(`\nSelecting: ${baseOption.text}`);
      await page.selectOption('#registrationDetails', baseOption.value!);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    }
    
    // Look for usage data
    console.log('\n3. Looking for usage data patterns...');
    
    // Pattern 1: kW with timestamp
    const kwWithTime = await page.locator('text=/\\d{1,3}(,\\d{3})*(\\.\\d+)?\\s*kW.*@.*[AP]M/').all();
    if (kwWithTime.length > 0) {
      for (const element of kwWithTime) {
        const text = await element.textContent();
        console.log(`✅ Found usage with time: ${text}`);
      }
    }
    
    // Pattern 2: Just kW values
    const kwValues = await page.locator('text=/\\d+.*kW/').all();
    if (kwValues.length > 0) {
      console.log(`\nFound ${kwValues.length} kW values:`);
      for (let i = 0; i < Math.min(3, kwValues.length); i++) {
        const text = await kwValues[i].textContent();
        console.log(`  - ${text}`);
      }
    }
    
    // Pattern 3: MW values
    const mwValues = await page.locator('text=/\\d+.*MW/').all();
    if (mwValues.length > 0) {
      console.log(`\nFound ${mwValues.length} MW values:`);
      for (const element of mwValues) {
        const text = await element.textContent();
        console.log(`  - ${text}`);
      }
    }
    
    // Check for charts
    console.log('\n4. Looking for chart elements...');
    const chartTypes = [
      { selector: 'canvas', name: 'Canvas charts' },
      { selector: 'svg.highcharts-root', name: 'Highcharts' },
      { selector: '.chart-container', name: 'Chart containers' },
      { selector: '[class*="chart"]', name: 'Chart classes' }
    ];
    
    for (const chartType of chartTypes) {
      const count = await page.locator(chartType.selector).count();
      if (count > 0) {
        console.log(`✅ Found ${count} ${chartType.name}`);
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/test-usage-validation.png',
      fullPage: false 
    });
    console.log('\n📸 Screenshot: test-usage-validation.png');
    
    // Test different registrations
    console.log('\n5. Testing different registrations...');
    
    const registrationsToTest = [
      'Rhode Island Hospital RI Energy Daily',
      'Rhode Island Hospital RI Energy Targeted'
    ];
    
    for (const regName of registrationsToTest) {
      const option = options.find(opt => opt.text?.includes(regName));
      if (option) {
        console.log(`\nTesting: ${option.text}`);
        await page.selectOption('#registrationDetails', option.value!);
        await page.waitForTimeout(3000);
        
        // Check for data
        const hasKW = await page.locator('text=/kW/').count() > 0;
        const hasChart = await page.locator('canvas').count() > 0;
        
        console.log(`  Has kW values: ${hasKW ? '✅' : '❌'}`);
        console.log(`  Has charts: ${hasChart ? '✅' : '❌'}`);
      }
    }
    
    console.log('\n✅ Validation test complete!');
    
    // Keep browser open
    console.log('\nPress Ctrl+C to close browser...');
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('Test failed:', error);
    await page.screenshot({ path: 'screenshots/test-validation-error.png' });
  } finally {
    await browser.close();
  }
}

// Run test
testUsageValidation().catch(console.error);
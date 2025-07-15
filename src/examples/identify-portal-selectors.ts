// Help identify selectors for your specific portal
import { chromium } from 'playwright';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

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

async function identifySelectors() {
  console.log('=== Portal Selector Identifier ===\n');

  const portalUrl = process.env.PORTAL_URL || await question('Enter portal URL: ');
  
  console.log(`\nOpening ${portalUrl}...`);
  console.log('This tool will help you identify the correct selectors for your portal.\n');

  const browser = await chromium.launch({ 
    headless: false,
    devtools: true  // Open DevTools automatically
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();

  try {
    await page.goto(portalUrl);
    
    console.log('Browser opened with DevTools.');
    console.log('\nINSTRUCTIONS:');
    console.log('1. Right-click on form elements and select "Inspect"');
    console.log('2. Note down the selectors for:');
    console.log('   - Username/email field');
    console.log('   - Password field');
    console.log('   - Login/Submit button');
    console.log('   - Search field (after login)');
    console.log('   - Any other important elements\n');

    // Wait for user to explore
    await question('Press Enter when you\'ve noted the LOGIN PAGE selectors...');

    // Try to detect common selectors automatically
    console.log('\nScanning for common selectors...\n');

    const selectors = {
      username: [
        'input[name="username"]',
        'input[name="user"]',
        'input[name="email"]',
        'input[type="email"]',
        'input[id*="user" i]',
        'input[id*="email" i]',
        'input[id*="login" i]',
        'input[placeholder*="user" i]',
        'input[placeholder*="email" i]'
      ],
      password: [
        'input[type="password"]',
        'input[name="password"]',
        'input[name="pass"]',
        'input[id*="pass" i]'
      ],
      submit: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'button:has-text("Submit")',
        'button:has-text("Log in")',
        '*[id*="login" i][type="button"]',
        '*[id*="submit" i]'
      ]
    };

    console.log('Found selectors:');
    console.log('==============\n');

    // Check username fields
    console.log('Username/Email fields:');
    for (const selector of selectors.username) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`  ✓ ${selector} (${elements.length} found)`);
          
          // Get more info about the first element
          const info = await elements[0].evaluate(el => ({
            id: el.id,
            name: el.getAttribute('name'),
            placeholder: el.getAttribute('placeholder'),
            type: el.getAttribute('type')
          }));
          console.log(`    Details: ${JSON.stringify(info)}`);
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Check password fields
    console.log('\nPassword fields:');
    for (const selector of selectors.password) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`  ✓ ${selector} (${elements.length} found)`);
        }
      } catch (e) {
        // Ignore errors
      }
    }

    // Check submit buttons
    console.log('\nSubmit buttons:');
    for (const selector of selectors.submit) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          console.log(`  ✓ ${selector} (${elements.length} found)`);
          
          // Get button text
          const texts = await Promise.all(
            elements.slice(0, 3).map(el => el.textContent())
          );
          console.log(`    Text: ${texts.map(t => `"${t?.trim()}"`).join(', ')}`);
        }
      } catch (e) {
        // Ignore errors
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('\nNOTE: Copy the working selectors and update them in:');
    console.log('src/services/screenshotService.ts (in the login() method)\n');

    // Ask if user wants to test login
    const testLogin = await question('Would you like to test login? (y/n): ');
    
    if (testLogin.toLowerCase() === 'y') {
      const username = process.env.PORTAL_USERNAME || await question('Username: ');
      const password = process.env.PORTAL_PASSWORD || await question('Password: ');
      
      const usernameSelector = await question('Username selector to use: ');
      const passwordSelector = await question('Password selector to use: ');
      const submitSelector = await question('Submit selector to use: ');
      
      try {
        await page.fill(usernameSelector, username);
        await page.fill(passwordSelector, password);
        await page.click(submitSelector);
        
        await page.waitForNavigation({ timeout: 10000 });
        
        console.log('\n✅ Login appears successful!');
        console.log(`Current URL: ${page.url()}`);
        
        // Look for search fields
        console.log('\nNow looking for search fields...');
        await question('Press Enter when you\'re on a page with a search field...');
        
        const searchSelectors = [
          'input[type="search"]',
          'input[name="search"]',
          'input[placeholder*="search" i]',
          'input[id*="search" i]',
          'input.search',
          '#search'
        ];
        
        console.log('\nSearch fields found:');
        for (const selector of searchSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements.length > 0) {
              console.log(`  ✓ ${selector} (${elements.length} found)`);
            }
          } catch (e) {
            // Ignore
          }
        }
        
      } catch (error) {
        console.error('\n❌ Login failed:', (error as Error).message);
      }
    }

    await question('\nPress Enter to close the browser...');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    rl.close();
  }
}

// Run the tool
if (require.main === module) {
  identifySelectors().catch(console.error);
}
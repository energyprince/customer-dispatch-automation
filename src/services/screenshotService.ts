// Playwright screenshot service for portal automation
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface ScreenshotConfig {
  portalUrl: string;
  username: string;
  password: string;
  headless?: boolean;
  timeout?: number;
  screenshotDir?: string;
  usageDataWaitTime?: number; // Time to wait for usage data to load (in ms)
}

export class ScreenshotService {
  private config: ScreenshotConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isLoggedIn: boolean = false;

  constructor(config: ScreenshotConfig) {
    this.config = {
      headless: true,
      timeout: 30000,
      screenshotDir: path.join(process.cwd(), 'screenshots'),
      ...config
    };
  }

  // Initialize browser
  async initialize(): Promise<void> {
    try {
      console.log('Launching browser...');
      
      // Ensure screenshot directory exists
      await fs.mkdir(this.config.screenshotDir!, { recursive: true });

      // Launch browser
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox'
        ]
      });

      // Create context with viewport
      this.context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      // Create page
      this.page = await this.context.newPage();
      
      // Set default timeout
      this.page.setDefaultTimeout(this.config.timeout!);
      
      console.log('✓ Browser initialized');
    } catch (error) {
      console.error('Error initializing browser:', error);
      throw error;
    }
  }

  // Login to portal
  async login(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    if (this.isLoggedIn) {
      console.log('Already logged in');
      return;
    }

    try {
      console.log(`Navigating to ${this.config.portalUrl}...`);
      await this.page.goto(this.config.portalUrl, { waitUntil: 'networkidle' });

      // Wait for CPower login form - uses #Username (capital U)
      console.log('Looking for CPower login form...');
      await this.page.waitForSelector('#Username', { timeout: 30000 });

      // Fill in credentials - CPower uses #Username and #Password (capitals)
      console.log('Entering credentials...');
      await this.page.fill('#Username', this.config.username);
      await this.page.fill('#Password', this.config.password);

      // Click submit - CPower uses button with "Log In" text
      console.log('Submitting login form...');
      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }),
        this.page.click('button:has-text("Log In")')
      ]);

      // Check if login was successful
      const currentUrl = this.page.url();
      if (currentUrl.includes('Authentication') || currentUrl.includes('login') || currentUrl.includes('error')) {
        // Check for error messages
        const errorSelectors = ['.error', '.alert-danger', '[role="alert"]', '.error-message'];
        for (const selector of errorSelectors) {
          const error = await this.page.$(selector);
          if (error) {
            const text = await error.textContent();
            throw new Error(`Login failed: ${text}`);
          }
        }
        throw new Error('Login may have failed - still on login page');
      }

      this.isLoggedIn = true;
      console.log('✓ Successfully logged in');
    } catch (error) {
      console.error('Error during login:', error);
      
      // Take screenshot for debugging
      const errorScreenshot = path.join(this.config.screenshotDir!, 'login-error.png');
      await this.page.screenshot({ path: errorScreenshot });
      console.log(`Error screenshot saved: ${errorScreenshot}`);
      
      throw error;
    }
  }

  // Search for a facility
  async searchFacility(facilityName: string): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    if (!this.isLoggedIn) {
      await this.login();
    }

    try {
      console.log(`Searching for facility: ${facilityName}`);

      // CPower uses #Search (capital S)
      console.log('Looking for CPower search field...');
      const searchField = await this.page.waitForSelector('#Search', { timeout: 10000 });
      
      if (!searchField) {
        console.warn('Could not find search field - navigation may be required');
        return false;
      }

      console.log('Found search field: #Search');
      
      // Try different search variations
      const searchVariations = [
        facilityName, // Full name: "Aaron Industries Leominster MA"
        facilityName.split(' ')[0], // First word only: "Aaron"
        facilityName.split(' ').slice(0, 2).join(' '), // First two words: "Aaron Industries"
        facilityName.replace(/\s+(MA|CT|RI|NH|VT|ME|NY|NJ|PA)$/i, ''), // Remove state abbreviation
      ];
      
      // Remove duplicates
      const uniqueSearches = [...new Set(searchVariations)];
      
      console.log(`Trying search variations: ${uniqueSearches.join(', ')}`);
      
      // Clear and enter search term
      await searchField.click({ clickCount: 3 }); // Triple click to select all
      await searchField.fill(uniqueSearches[0]); // Start with the full name

      // Press Enter or click search button
      await this.page.keyboard.press('Enter');
      
      // Wait for results to load
      await this.page.waitForTimeout(2000);
      
      // Store the search term used for later reference
      (this as any).lastSearchTerm = uniqueSearches[0];
      
      return true;
    } catch (error) {
      console.error('Error searching for facility:', error);
      return false;
    }
  }

  // Enhanced captureUsage method with usage data validation
  async captureUsage(facilityName: string, contactName?: string, dispatchType?: string): Promise<string | null> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    if (!this.isLoggedIn) {
      await this.login();
    }

    try {
      console.log(`\nCapturing usage for: ${facilityName}`);
      if (contactName) {
        console.log(`Contact: ${contactName}`);
      }
      if (dispatchType) {
        console.log(`Dispatch type: ${dispatchType}`);
      }

      // If we need to impersonate a specific contact
      if (contactName && !this.page.url().includes('Dashboard')) {
        // Search for facility first
        const searchSuccessful = await this.searchFacility(facilityName);
        
        if (searchSuccessful) {
          console.log(`Looking for specific contact: ${contactName}`);
          try {
            // Wait a bit for search results to fully load
            await this.page.waitForTimeout(3000);
            
            // Debug: Check what's on the page
            const tableRows = await this.page.locator('tr').count();
            console.log(`Found ${tableRows} table rows on page`);
            
            // Check if there are any results
            const noResultsText = await this.page.locator('text=/no.*results?/i').count();
            if (noResultsText > 0) {
              console.log('No search results found');
              
              // Try searching with just the first word
              const firstName = facilityName.split(' ')[0];
              console.log(`Trying simplified search: ${firstName}`);
              
              const searchField = await this.page.$('#Search');
              if (searchField) {
                await searchField.click({ clickCount: 3 });
                await searchField.fill(firstName);
                await this.page.keyboard.press('Enter');
                await this.page.waitForTimeout(3000);
              }
            }
            
            // Try different selectors for finding the contact
            const contactSelectors = [
              `tr:has(span[data-name="UserName"]:has-text("${contactName}"))`,
              `tr:has(td:has-text("${contactName}"))`,
              `tr:has-text("${contactName}")`
            ];
            
            let contactRow = null;
            for (const selector of contactSelectors) {
              const rows = await this.page.locator(selector).all();
              if (rows.length > 0) {
                contactRow = rows[0];
                console.log(`Found contact with selector: ${selector}`);
                break;
              }
            }
            
            if (contactRow) {
              console.log(`Found contact row for: ${contactName}`);
              await contactRow.click();
              await this.page.waitForTimeout(1500);
              
              // Click the impersonate button
              const impersonateBtn = this.page.locator('#ImpersonateBtn:not([disabled])');
              if (await impersonateBtn.count() > 0) {
                console.log('Clicking impersonate button...');
                await impersonateBtn.click();
                await this.page.waitForLoadState('networkidle', { timeout: 40000 });
                await this.page.waitForTimeout(5000);
              } else {
                console.log('Impersonate button not available or disabled');
                return null;
              }
            } else {
              console.warn(`Could not find contact: ${contactName}`);
              // Let's see what contacts are available
              const allUserNames = await this.page.locator('span[data-name="UserName"]').allTextContents();
              console.log(`Available contacts for ${facilityName}:`, allUserNames.slice(0, 5));
              
              // Take a debug screenshot to see what's on the page
              const debugPath = path.join(this.config.screenshotDir!, `search-debug-${facilityName.replace(/[^a-z0-9]/gi, '-')}_${Date.now()}.png`);
              await this.page.screenshot({ path: debugPath, fullPage: true });
              console.log(`Search debug screenshot saved: ${debugPath}`);
              
              return null;
            }
          } catch (e) {
            console.error(`Error selecting contact ${contactName}:`, e);
            return null;
          }
        }
      }

      // Navigate to Dashboard if needed (only if we're already logged in as a user)
      const currentUrl = this.page.url();
      if (!currentUrl.includes('Dashboard') && currentUrl.includes('/Home/')) {
        console.log('Navigating to dashboard...');
        try {
          await this.page.click('a:has-text("Dashboard")', { timeout: 5000 });
          await this.page.waitForLoadState('networkidle');
        } catch (e) {
          console.log('Could not navigate to dashboard');
        }
      }

      // Helper function to check if usage data is visible
      const page = this.page; // Capture page reference
      const hasUsageData = async (): Promise<boolean> => {
        if (!page) return false;
        
        try {
          // Look for usage patterns like "5,606kW @ 1:00 PM"
          const usagePatterns = [
            /\d{1,3}(,\d{3})*(\.\d+)?\s*kW/i,  // Matches: 5,606kW or 5606.5kW
            /\d{1,3}(,\d{3})*(\.\d+)?\s*MW/i,  // Matches: 1.5MW or 1,500MW
            /Load Estimate.*kW/i,               // Matches: Load Estimate (kW)
          ];
          
          // Check for text matching usage patterns
          for (const pattern of usagePatterns) {
            const elements = await page.locator(`text=/${pattern.source}/`).all();
            if (elements.length > 0) {
              const firstMatch = await elements[0].textContent();
              // Skip if it's just 0.00 kWh or similar
              if (firstMatch && 
                  !firstMatch.includes('0.00') && 
                  !firstMatch.includes('0 kW') &&
                  firstMatch !== 'kWh') {
                console.log(`Found usage data: ${firstMatch}`);
                return true;
              }
            }
          }
          
          // Also check for chart elements
          const chartSelectors = ['canvas', 'svg.highcharts-root', '.chart-container:has(canvas)'];
          for (const selector of chartSelectors) {
            const chartElement = await page.$(selector);
            if (chartElement) {
              console.log(`Found chart element: ${selector}`);
              return true;
            }
          }
          
          return false;
        } catch (e) {
          return false;
        }
      };

      // Handle registration dropdown with validation
      console.log('Checking registration dropdown...');
      
      try {
        await this.page.waitForSelector('#registrationDetails', { timeout: 10000 });
        
        // Get all available options
        const options = await this.page.$$eval('#registrationDetails option', 
          opts => opts.map(opt => ({
            value: opt.getAttribute('value') || '',
            text: opt.textContent || '',
            title: opt.getAttribute('title') || '',
            selected: opt.hasAttribute('selected')
          }))
        );
        
        console.log(`Found ${options.length} registration options`);
        
        // Determine which registrations to try
        let registrationsToTry: any[] = [];
        
        // For Rhode Island Hospital, prioritize base facility
        if (facilityName.includes('Rhode Island Hospital')) {
          // First try: Base facility (just "Rhode Island Hospital")
          const baseFacility = options.find(opt => 
            opt.text === 'Rhode Island Hospital' || 
            opt.title === 'Rhode Island Hospital'
          );
          if (baseFacility) registrationsToTry.push(baseFacility);
          
          // Second try: RI Energy Targeted (if dispatch type is RI ET)
          if (dispatchType?.includes('RI ET')) {
            const targeted = options.find(opt => 
              opt.text?.includes('RI Energy Targeted')
            );
            if (targeted) registrationsToTry.push(targeted);
          }
          
          // Third try: Any other Rhode Island Hospital option
          const others = options.filter(opt => 
            opt.text?.includes('Rhode Island Hospital') &&
            !registrationsToTry.some(r => r.value === opt.value)
          );
          registrationsToTry.push(...others);
        } else {
          // For other facilities, try options based on dispatch type
          if (dispatchType?.includes('RI ET') || dispatchType?.includes('Targeted')) {
            // Try targeted options first
            const targeted = options.filter(opt => 
              opt.text?.includes(facilityName) && 
              (opt.text?.includes('Targeted') || opt.text?.includes('RI Energy Targeted'))
            );
            registrationsToTry.push(...targeted);
          }
          
          // Then try base facility
          const base = options.find(opt => 
            opt.text === facilityName || opt.title === facilityName
          );
          if (base) registrationsToTry.push(base);
          
          // Finally, any other matching options
          const others = options.filter(opt => 
            opt.text?.includes(facilityName) &&
            !registrationsToTry.some(r => r.value === opt.value)
          );
          registrationsToTry.push(...others);
        }
        
        // Try each registration until we find one with data
        let foundDataWithRegistration = false;
        
        for (const registration of registrationsToTry) {
          console.log(`\nTrying registration: ${registration.text || registration.title}`);
          
          // Select the registration
          await this.page.selectOption('#registrationDetails', registration.value!);
          await this.page.waitForLoadState('networkidle');
          
          // Wait longer for Rhode Island Hospital base facility as it takes time to load
          if (facilityName.includes('Rhode Island Hospital') && registration.text === 'Rhode Island Hospital') {
            console.log('Waiting for Rhode Island Hospital base facility data to load (this may take up to 35 seconds)...');
            
            // Use the configured wait time or default to 35 seconds
            const waitTime = this.config.usageDataWaitTime || 35000;
            
            // Wait for data to load (not just loading indicators)
            let dataLoaded = false;
            const startTime = Date.now();
            
            console.log('Waiting for real usage data to load...');
            
            while (!dataLoaded && (Date.now() - startTime) < waitTime) {
              // Check for loading indicators - if present, data is still loading
              const loadingIndicators = [
                '.loading',
                '.spinner',
                '[class*="loading"]',
                '[class*="spinner"]',
                'div[role="status"]',
                '.fa-spin',
                '.fa-spinner',
                'text=/Please wait.*Chart is being loaded/i',
                'text=/Loading/i'
              ];
              
              let hasLoadingIndicator = false;
              for (const selector of loadingIndicators) {
                const count = await this.page.locator(selector).count();
                if (count > 0) {
                  hasLoadingIndicator = true;
                  console.log(`Still loading (found ${selector})...`);
                  break;
                }
              }
              
              // If no loading indicators, check for actual data
              if (!hasLoadingIndicator) {
                const currentUsage = await this.getUsageValue();
                
                // Look for real usage data (not 0.00 kWh or just kWh)
                if (currentUsage && 
                    currentUsage !== '0.00 kWh' && 
                    currentUsage !== '0 kWh' &&
                    currentUsage !== 'kWh' &&
                    currentUsage.includes('@')) {  // Should have timestamp like "5,606kW @ 1:00 PM"
                  console.log(`✅ Real usage data loaded: ${currentUsage}`);
                  dataLoaded = true;
                  break;
                }
                
                // Also check for charts with actual data
                const hasCharts = await this.page.locator('canvas').count() > 0;
                
                if (hasCharts && !currentUsage?.includes('0.00')) {
                  console.log('✅ Found charts with data');
                  dataLoaded = true;
                  break;
                }
              }
              
              // Wait before checking again
              await this.page.waitForTimeout(2000);
              
              // Show progress
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              if (elapsed % 5 === 0) {
                console.log(`Still waiting for real data... ${elapsed}s elapsed`);
              }
            }
            
            if (!dataLoaded) {
              console.warn('⚠️ Timeout waiting for real usage data');
            }
            
            // Wait for blockUI overlays specific to Rhode Island Hospital
            console.log('Waiting for loading overlays...');
            try {
              await this.page.waitForFunction(
                () => {
                  const blockUIElements = document.querySelectorAll('.blockUI.blockMsg.blockElement');
                  for (const element of blockUIElements) {
                    const style = window.getComputedStyle(element);
                    if (style.display !== 'none' && parseFloat(style.opacity) > 0.1) {
                      return false;
                    }
                  }
                  const animatingElements = document.querySelectorAll('.blockUI');
                  for (const element of animatingElements) {
                    const style = window.getComputedStyle(element);
                    const opacity = parseFloat(style.opacity);
                    if (opacity > 0.1 && opacity < 0.9) {
                      return false;
                    }
                  }
                  return true;
                },
                { timeout: 15000 }
              );
            } catch (e) {
              console.warn('Timeout waiting for overlays');
            }
            
            // Extra wait to ensure everything is rendered
            console.log('Waiting for UI to stabilize...');
            await this.page.waitForTimeout(3000);
            console.log('Ready to take screenshot');
          } else {
            // Standard wait for other registrations
            await this.page.waitForTimeout(5000);
          }
          
          // Check if we have usage data
          if (await hasUsageData()) {
            console.log('✅ Found usage data with this registration');
            foundDataWithRegistration = true;
            break;
          } else {
            console.log('❌ No usage data found, trying next option...');
          }
        }
        
        if (!foundDataWithRegistration && registrationsToTry.length > 0) {
          console.warn('Could not find usage data with any registration option');
        }
        
      } catch (error) {
        console.log('Error handling registration dropdown:', error);
      }

      // Handle program tabs if needed
      if (dispatchType?.includes('Targeted')) {
        console.log('Looking for Targeted Dispatch tab...');
        try {
          // Try multiple selectors for the Targeted Dispatch tab
          const tabSelectors = [
            'a[id="176"]:has-text("Targeted Dispatch")',  // ID as attribute selector
            'a[data-iscapacity="true"]:has-text("Targeted Dispatch")',
            'a:has-text("Targeted Dispatch")'
          ];
          
          let targetedTab = null;
          for (const selector of tabSelectors) {
            targetedTab = await this.page.$(selector);
            if (targetedTab) {
              console.log(`Found tab with selector: ${selector}`);
              break;
            }
          }
          
          if (targetedTab) {
            console.log('Waiting for any overlays before clicking tab...');
            // Wait for blockUI to disappear before clicking
            try {
              await this.page.waitForFunction(
                () => {
                  const overlays = document.querySelectorAll('.blockUI.blockOverlay, .blockUI.blockMsg');
                  for (const overlay of overlays) {
                    const style = window.getComputedStyle(overlay);
                    if (style.display !== 'none' && parseFloat(style.opacity) > 0.1) {
                      return false;
                    }
                  }
                  return true;
                },
                { timeout: 10000 }
              );
            } catch (e) {
              console.warn('Timeout waiting for overlays before tab click');
            }
            
            console.log('Re-finding and clicking Targeted Dispatch tab...');
            // Re-find the element after waiting to avoid DOM detachment
            for (const selector of tabSelectors) {
              const freshTab = await this.page.$(selector);
              if (freshTab) {
                await freshTab.click();
                await this.page.waitForLoadState('networkidle');
                break;
              }
            }
            
            // Wait for chart to load after tab click
            console.log('Waiting for Targeted Dispatch data to load...');
            const waitTime = this.config.usageDataWaitTime || 35000;
            const startTime = Date.now();
            
            while ((Date.now() - startTime) < waitTime) {
              // Check for "Please wait ! Chart is being loaded....." message
              const loadingMessage = await this.page.locator('text=/Please wait.*Chart is being loaded/i').count();
              if (loadingMessage > 0) {
                console.log('Chart is still loading...');
                await this.page.waitForTimeout(2000);
                continue;
              }
              
              // Check if we have actual usage data
              const hasData = await hasUsageData();
              if (hasData) {
                console.log('✅ Targeted Dispatch data loaded');
                break;
              }
              
              await this.page.waitForTimeout(2000);
              
              // Show progress
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              if (elapsed % 5 === 0) {
                console.log(`Still waiting for data... ${elapsed}s elapsed`);
              }
            }
            
            // Wait for blockUI overlays after tab switch
            console.log('Waiting for loading overlays after tab switch...');
            try {
              await this.page.waitForFunction(
                () => {
                  const blockUIElements = document.querySelectorAll('.blockUI.blockMsg.blockElement');
                  for (const element of blockUIElements) {
                    const style = window.getComputedStyle(element);
                    if (style.display !== 'none' && parseFloat(style.opacity) > 0.1) {
                      return false;
                    }
                  }
                  return true;
                },
                { timeout: 15000 }
              );
            } catch (e) {
              console.warn('Timeout waiting for overlays after tab switch');
            }
            
            // Extra stabilization wait
            await this.page.waitForTimeout(2000);
          } else {
            console.log('Could not find Targeted Dispatch tab with any selector');
          }
        } catch (e) {
          console.log('Error clicking Targeted Dispatch tab:', e);
        }
      }

      // Wait for blockUI loading overlays to disappear
      console.log('Waiting for loading overlays to disappear...');
      try {
        await this.page.waitForFunction(
          () => {
            // Check for any visible blockUI elements
            const blockUIElements = document.querySelectorAll('.blockUI.blockMsg.blockElement');
            for (const element of blockUIElements) {
              const style = window.getComputedStyle(element);
              // Check if element is visible (not display: none and has opacity)
              if (style.display !== 'none' && parseFloat(style.opacity) > 0.1) {
                return false; // Still loading
              }
            }
            
            // Also check for elements that are being animated
            const animatingElements = document.querySelectorAll('.blockUI');
            for (const element of animatingElements) {
              const style = window.getComputedStyle(element);
              // Check if opacity is animating (not 0 or 1)
              const opacity = parseFloat(style.opacity);
              if (opacity > 0.1 && opacity < 0.9) {
                return false; // Still animating
              }
            }
            
            return true; // All loading overlays are gone
          },
          { timeout: 30000 }
        );
        console.log('✅ All loading overlays cleared');
      } catch (e) {
        console.warn('⚠️ Timeout waiting for loading overlays to clear');
      }

      // Final validation before taking screenshot
      console.log('\nValidating usage data before screenshot...');
      const hasData = await hasUsageData();
      
      if (!hasData) {
        console.warn('⚠️  WARNING: No usage data found on page!');
        console.log('Taking screenshot anyway for debugging...');
        
        // Take debug screenshot
        const debugPath = await this.debugScreenshot(`no-data-${facilityName.replace(/[^a-z0-9]/gi, '_')}`);
        console.log(`Debug screenshot: ${debugPath}`);
      } else {
        console.log('✅ Usage data confirmed on page');
      }

      // Look for specific usage value to include in logs
      try {
        const usageElement = await this.page.locator('text=/\\d{1,3}(,\\d{3})*(\\.\\d+)?\\s*kW.*@.*[AP]M/').first();
        if (await usageElement.count() > 0) {
          const usageText = await usageElement.textContent();
          console.log(`Current usage: ${usageText}`);
        }
      } catch (e) {
        // Not critical if we can't find the exact text
      }

      // Take the screenshot
      const timestamp = new Date().getTime();
      const filename = `${facilityName.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.png`;
      const filepath = path.join(this.config.screenshotDir!, filename);

      console.log('Taking screenshot...');
      
      // Take a focused screenshot of the main content area
      // Try to exclude headers/navigation if possible
      await this.page.screenshot({ 
        path: filepath,
        fullPage: false,
        clip: {
          x: 0,
          y: 0,  // Skip header
          width: 1400,
          height: 600  // Focus on main content
        }
      });

      console.log(`✓ Screenshot saved: ${filename}`);
      
      // Return null if no data was found (so caller can handle it)
      if (!hasData) {
        console.warn('Returning null due to missing usage data');
        return null;
      }
      
      return filepath;

    } catch (error) {
      console.error(`Failed to capture usage for ${facilityName}:`, error);
      await this.debugScreenshot(`error-${facilityName.replace(/[^a-z0-9]/gi, '_')}`);
      return null;
    }
  }

  // Helper method to extract usage value from the page
  async getUsageValue(): Promise<string | null> {
    if (!this.page) return null;
    
    try {
      // Look for patterns like "5,606kW @ 1:00 PM"
      const usageElement = await this.page.locator('text=/\\d{1,3}(,\\d{3})*(\\.\\d+)?\\s*kW.*@.*[AP]M/').first();
      if (await usageElement.count() > 0) {
        return await usageElement.textContent();
      }
      
      // Try simpler pattern
      const simpleUsage = await this.page.locator('text=/\\d+.*kW/').first();
      if (await simpleUsage.count() > 0) {
        return await simpleUsage.textContent();
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }

  // Close browser
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.isLoggedIn = false;
    console.log('Browser closed');
  }

  // Get status
  getStatus(): {
    browserOpen: boolean;
    loggedIn: boolean;
    url?: string;
  } {
    return {
      browserOpen: this.browser !== null,
      loggedIn: this.isLoggedIn,
      url: this.page?.url()
    };
  }

  // Take a debug screenshot
  async debugScreenshot(name: string = 'debug'): Promise<string | null> {
    if (!this.page) return null;

    try {
      const filename = `${name}_${Date.now()}.png`;
      const filepath = path.join(this.config.screenshotDir!, filename);
      await this.page.screenshot({ path: filepath, fullPage: true });
      console.log(`Debug screenshot: ${filename}`);
      return filepath;
    } catch (error) {
      console.error('Error taking debug screenshot:', error);
      return null;
    }
  }
}

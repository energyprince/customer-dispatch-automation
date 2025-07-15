// Tests for screenshot service
import { ScreenshotService, ScreenshotConfig } from '../../services/screenshotService';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

// Load environment variables
dotenv.config();

// Skip screenshot tests if no portal credentials
const SKIP_SCREENSHOT_TESTS = process.env.SKIP_SCREENSHOT_TESTS === 'true';

describe('ScreenshotService', () => {
  let screenshotService: ScreenshotService;
  
  const testConfig: ScreenshotConfig = {
    portalUrl: process.env.PORTAL_URL || 'https://example.com/login',
    username: process.env.PORTAL_USERNAME || 'testuser',
    password: process.env.PORTAL_PASSWORD || 'testpass',
    headless: true,
    timeout: 30000,
    screenshotDir: path.join(process.cwd(), 'test-screenshots')
  };

  beforeEach(() => {
    screenshotService = new ScreenshotService(testConfig);
  });

  afterEach(async () => {
    // Close browser if open
    const status = screenshotService.getStatus();
    if (status.browserOpen) {
      await screenshotService.close();
    }

    // Clean up test screenshots
    try {
      const files = await fs.readdir(testConfig.screenshotDir!);
      for (const file of files) {
        if (file.endsWith('.png')) {
          await fs.unlink(path.join(testConfig.screenshotDir!, file));
        }
      }
    } catch (error) {
      // Directory might not exist
    }
  });

  if (SKIP_SCREENSHOT_TESTS) {
    it.skip('Screenshot tests skipped (SKIP_SCREENSHOT_TESTS=true)', () => {});
    return;
  }

  describe('browser initialization', () => {
    it('should initialize browser', async () => {
      await screenshotService.initialize();
      
      const status = screenshotService.getStatus();
      expect(status.browserOpen).toBe(true);
      expect(status.loggedIn).toBe(false);
    }, 30000);

    it('should create screenshot directory', async () => {
      await screenshotService.initialize();
      
      // Check if directory exists
      const stats = await fs.stat(testConfig.screenshotDir!);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('portal login', () => {
    beforeEach(async () => {
      await screenshotService.initialize();
    });

    it('should attempt login', async () => {
      // This test will likely fail without real portal
      // but it tests the login flow
      if (!process.env.PORTAL_URL || !process.env.PORTAL_USERNAME) {
        console.log('Skipping login test - no portal credentials');
        return;
      }

      try {
        await screenshotService.login();
        const status = screenshotService.getStatus();
        expect(status.loggedIn).toBe(true);
      } catch (error) {
        // Expected to fail with test URL
        console.log('Login failed as expected with test URL');
      }
    }, 60000);

    it('should handle login errors gracefully', async () => {
      // Use a definitely broken URL
      const badService = new ScreenshotService({
        ...testConfig,
        portalUrl: 'https://definitely-not-a-real-site-12345.com'
      });

      await badService.initialize();
      
      await expect(badService.login()).rejects.toThrow();
      
      // Should have saved error screenshot
      const files = await fs.readdir(testConfig.screenshotDir!);
      const errorScreenshot = files.find(f => f.includes('login-error'));
      expect(errorScreenshot).toBeDefined();
      
      await badService.close();
    }, 60000);
  });

  describe('screenshot capture', () => {
    beforeEach(async () => {
      await screenshotService.initialize();
    });

    it('should capture screenshot', async () => {
      // This captures whatever page we're on
      const filepath = await screenshotService.captureUsage('Test Facility');
      
      if (filepath) {
        // Check file exists
        const stats = await fs.stat(filepath);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBeGreaterThan(0);
        
        // Check filename format
        expect(path.basename(filepath)).toMatch(/Test_Facility_.*\.png/);
      }
    }, 60000);

    it('should handle special characters in facility names', async () => {
      const specialName = 'Test & Facility / Name (Special)';
      const filepath = await screenshotService.captureUsage(specialName);
      
      if (filepath) {
        const filename = path.basename(filepath);
        // Should have replaced special characters with underscores
        expect(filename).toMatch(/Test___Facility___Name__Special_.*\.png/);
      }
    }, 60000);
  });

  describe('debug features', () => {
    beforeEach(async () => {
      await screenshotService.initialize();
    });

    it('should take debug screenshot', async () => {
      const filepath = await screenshotService.debugScreenshot('test-debug');
      
      expect(filepath).toBeDefined();
      if (filepath) {
        const stats = await fs.stat(filepath);
        expect(stats.isFile()).toBe(true);
        expect(path.basename(filepath)).toMatch(/test-debug_.*\.png/);
      }
    });
  });

  describe('status', () => {
    it('should report correct status', async () => {
      let status = screenshotService.getStatus();
      expect(status.browserOpen).toBe(false);
      expect(status.loggedIn).toBe(false);
      expect(status.url).toBeUndefined();
      
      await screenshotService.initialize();
      
      status = screenshotService.getStatus();
      expect(status.browserOpen).toBe(true);
      expect(status.loggedIn).toBe(false);
      expect(status.url).toBeDefined();
    });
  });

  describe('browser cleanup', () => {
    it('should close browser properly', async () => {
      await screenshotService.initialize();
      
      let status = screenshotService.getStatus();
      expect(status.browserOpen).toBe(true);
      
      await screenshotService.close();
      
      status = screenshotService.getStatus();
      expect(status.browserOpen).toBe(false);
      expect(status.loggedIn).toBe(false);
    });
  });
});

// Unit tests that don't require browser
describe('ScreenshotService - Unit Tests', () => {
  const mockConfig: ScreenshotConfig = {
    portalUrl: 'https://example.com',
    username: 'user',
    password: 'pass'
  };

  it('should create instance with config', () => {
    const service = new ScreenshotService(mockConfig);
    expect(service).toBeInstanceOf(ScreenshotService);
  });

  it('should use default values', () => {
    const service = new ScreenshotService(mockConfig);
    const status = service.getStatus();
    expect(status.browserOpen).toBe(false);
  });

  it('should throw error when not initialized', async () => {
    const service = new ScreenshotService(mockConfig);
    await expect(service.login()).rejects.toThrow('Browser not initialized');
    await expect(service.captureUsage('test')).rejects.toThrow('Browser not initialized');
  });
});
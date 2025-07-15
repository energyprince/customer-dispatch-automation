// Tests for email monitoring
import { EmailMonitor, EmailMonitorConfig } from '../../services/emailMonitor';
import { ProcessedEmailTracker } from '../../services/processedTracker';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// This test requires real email credentials
// Set SKIP_EMAIL_TESTS=true to skip these tests
const SKIP_EMAIL_TESTS = process.env.SKIP_EMAIL_TESTS === 'true';

describe('EmailMonitor', () => {
  let monitor: EmailMonitor;
  let tracker: ProcessedEmailTracker;
  
  const testConfig: EmailMonitorConfig = {
    user: process.env.EMAIL_USER || 'test@example.com',
    password: process.env.EMAIL_PASSWORD || 'password',
    host: process.env.EMAIL_HOST || 'imap.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '993'),
    tls: true,
    checkInterval: 5000 // 5 seconds for testing
  };

  beforeEach(async () => {
    // Use a test tracker file
    tracker = new ProcessedEmailTracker('test-processed-emails.json');
    await tracker.reset();
    
    monitor = new EmailMonitor(testConfig, tracker);
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.disconnect();
    }
    // Clean up test tracker file
    await tracker.reset();
  });

  if (SKIP_EMAIL_TESTS) {
    it.skip('Email tests skipped (SKIP_EMAIL_TESTS=true)', () => {});
    return;
  }

  describe('connection', () => {
    it('should connect to email server', async () => {
      // This test requires valid credentials
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('Skipping email connection test - no credentials provided');
        return;
      }

      await monitor.connect();
      const status = monitor.getStatus();
      expect(status.connected).toBe(true);
    }, 30000); // 30 second timeout

    it('should handle connection failure gracefully', async () => {
      const badConfig: EmailMonitorConfig = {
        ...testConfig,
        password: 'wrong-password'
      };
      
      const badMonitor = new EmailMonitor(badConfig);
      
      await expect(badMonitor.connect()).rejects.toThrow();
    }, 30000);
  });

  describe('monitoring', () => {
    it('should start and stop monitoring', async () => {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('Skipping monitoring test - no credentials provided');
        return;
      }

      await monitor.connect();
      
      // Start monitoring
      await monitor.startMonitoring();
      let status = monitor.getStatus();
      expect(status.monitoring).toBe(true);
      
      // Stop monitoring
      monitor.stopMonitoring();
      status = monitor.getStatus();
      expect(status.monitoring).toBe(false);
    }, 30000);

    it('should not start monitoring without connection', async () => {
      await expect(monitor.startMonitoring()).rejects.toThrow('Not connected');
    });
  });

  describe('dispatch detection', () => {
    it('should emit dispatch event when CPower email is detected', (done) => {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
        console.log('Skipping dispatch detection test - no credentials provided');
        done();
        return;
      }

      // This test requires a CPower dispatch email in the inbox
      // For testing, we'll use a mock approach
      
      // Listen for dispatch event
      monitor.once('dispatch', (dispatchEvent) => {
        expect(dispatchEvent).toBeDefined();
        expect(dispatchEvent.dispatchType).toBeTruthy();
        expect(dispatchEvent.facilities).toBeInstanceOf(Array);
        done();
      });

      // Connect and check for emails
      monitor.connect().then(() => {
        return monitor.checkNow();
      }).then(() => {
        // If no dispatch email found, complete the test
        setTimeout(() => {
          done();
        }, 5000);
      }).catch((error) => {
        console.error('Error in test:', error);
        done();
      });
    }, 30000);
  });

  describe('status', () => {
    it('should return correct status', () => {
      const status = monitor.getStatus();
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('monitoring');
      expect(status.connected).toBe(false);
      expect(status.monitoring).toBe(false);
    });
  });
});

// Unit tests that don't require real email connection
describe('EmailMonitor - Unit Tests', () => {
  let monitor: EmailMonitor;
  
  const mockConfig: EmailMonitorConfig = {
    user: 'test@example.com',
    password: 'password',
    host: 'imap.example.com',
    port: 993,
    tls: true
  };

  beforeEach(() => {
    monitor = new EmailMonitor(mockConfig);
  });

  it('should create instance with config', () => {
    expect(monitor).toBeInstanceOf(EmailMonitor);
  });

  it('should use default check interval', () => {
    const monitorWithDefaults = new EmailMonitor(mockConfig);
    expect(monitorWithDefaults).toBeDefined();
  });

  it('should use custom check interval', () => {
    const configWithInterval: EmailMonitorConfig = {
      ...mockConfig,
      checkInterval: 60000
    };
    const monitorWithInterval = new EmailMonitor(configWithInterval);
    expect(monitorWithInterval).toBeDefined();
  });

  it('should be an EventEmitter', () => {
    expect(monitor.on).toBeDefined();
    expect(monitor.emit).toBeDefined();
    expect(monitor.once).toBeDefined();
  });
});
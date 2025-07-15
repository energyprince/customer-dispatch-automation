import { EmailMonitor } from '../../services/emailMonitor';
import { ProcessedEmailTracker } from '../../services/processedTracker';
import { Scheduler } from '../../services/scheduler';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Email Monitor Integration', () => {
  let monitor: EmailMonitor;
  let tracker: ProcessedEmailTracker;
  let scheduler: Scheduler;

  beforeEach(async () => {
    tracker = new ProcessedEmailTracker();
    const config = {
      user: process.env.EMAIL_USER || 'test@example.com',
      password: process.env.EMAIL_PASSWORD || 'password',
      host: process.env.EMAIL_HOST || 'imap.gmail.com',
      port: 993,
      tls: true
    };
    monitor = new EmailMonitor(config, tracker);
    scheduler = new Scheduler();
    await scheduler.initialize();
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.disconnect().catch(() => {});
    }
  });

  test('should connect to email server', async () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('Skipping email test - credentials not configured');
      return;
    }

    await expect(monitor.connect()).resolves.not.toThrow();
  });

  test('should emit dispatch events when dispatch email is detected', (done) => {
    const testDispatchEvent = {
      messageId: 'test-123',
      subject: 'Test Dispatch Event',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/New_York',
      facilities: [{
        companyName: 'Test Company',
        facilityName: 'Test Facility',
        address: '123 Test St',
        accountNumber: 'TEST-123',
        dispatchTarget: '100 kW'
      }],
      rawContent: 'Test content'
    };

    monitor.on('dispatch', (event) => {
      expect(event).toBeDefined();
      expect(event.facilities).toBeDefined();
      expect(event.facilities.length).toBeGreaterThan(0);
      done();
    });

    // Simulate dispatch event
    monitor.emit('dispatch', testDispatchEvent);
  });

  test('should schedule notifications when dispatch is received', (done) => {
    const testDispatchEvent = {
      messageId: 'test-456',
      subject: 'Test Dispatch Event',
      from: 'test@cpower.com',
      dispatchType: 'Targeted Dispatch',
      eventDate: new Date(),
      startTime: new Date(Date.now() + 60000), // 1 minute from now
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/New_York',
      facilities: [
        {
          companyName: 'Test Company 1',
          facilityName: 'Test Facility 1',
          address: '123 Test St',
          accountNumber: 'TEST-001',
          dispatchTarget: '200 kW'
        },
        {
          companyName: 'Test Company 2',
          facilityName: 'Test Facility 2',
          address: '456 Test Ave',
          accountNumber: 'TEST-002',
          dispatchTarget: '300 kW'
        }
      ],
      rawContent: 'Test dispatch'
    };

    let scheduledCount = 0;

    scheduler.on('jobScheduled', (data) => {
      expect(data.facilityName).toBeDefined();
      expect(data.scheduledTime).toBeDefined();
      scheduledCount++;
      
      if (scheduledCount === testDispatchEvent.facilities.length) {
        done();
      }
    });

    scheduler.scheduleDispatchNotifications(testDispatchEvent);
  });

  test('should handle immediate processing for past events', () => {
    const pastEvent = {
      messageId: 'test-789',
      subject: 'Past Dispatch Event',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(Date.now() - 1800000), // 30 minutes ago
      timezone: 'America/New_York',
      facilities: [{
        companyName: 'Past Company',
        facilityName: 'Past Facility',
        address: '789 Past Rd',
        accountNumber: 'PAST-123',
        dispatchTarget: '150 kW'
      }],
      rawContent: 'Past event'
    };

    // Should not throw and should process immediately
    expect(() => scheduler.scheduleDispatchNotifications(pastEvent)).not.toThrow();
  });
});
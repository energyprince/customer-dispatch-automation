import { Scheduler } from '../../services/scheduler';
import { EmailSender } from '../../services/emailSender';
import { DispatchEvent } from '../../types';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Scheduler Service', () => {
  let scheduler: Scheduler;
  let emailSender: EmailSender;

  beforeEach(async () => {
    scheduler = new Scheduler();
    emailSender = new EmailSender();
    await scheduler.initialize();
  });

  afterEach(() => {
    scheduler.cancelAllJobs();
  });

  test('should initialize successfully', async () => {
    const newScheduler = new Scheduler();
    await expect(newScheduler.initialize()).resolves.not.toThrow();
  });

  test('should schedule jobs for future events', () => {
    const futureEvent: DispatchEvent = {
      messageId: 'test-future-123',
      subject: 'Future Dispatch',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() + 120000), // 2 minutes from now
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/New_York',
      facilities: [
        {
          companyName: 'Company A',
          facilityName: 'Facility A',
          address: '123 A St',
          accountNumber: 'A-123',
          dispatchTarget: '100 kW'
        },
        {
          companyName: 'Company B',
          facilityName: 'Facility B',
          address: '456 B Ave',
          accountNumber: 'B-456',
          dispatchTarget: '200 kW'
        },
        {
          companyName: 'Company C',
          facilityName: 'Facility C',
          address: '789 C Rd',
          accountNumber: 'C-789',
          dispatchTarget: '300 kW'
        }
      ],
      rawContent: 'Test future event'
    };

    scheduler.scheduleDispatchNotifications(futureEvent);
    
    const activeJobs = scheduler.getActiveJobs();
    expect(activeJobs.length).toBe(3);
    expect(activeJobs[0].status).toBe('pending');
  });

  test('should process past events immediately', (done) => {
    const pastEvent: DispatchEvent = {
      messageId: 'test-past-123',
      subject: 'Past Dispatch',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() - 3600000), // 1 hour ago
      endTime: new Date(Date.now() - 1800000),
      timezone: 'America/New_York',
      facilities: [{
        companyName: 'Past Company',
        facilityName: 'Past Facility',
        address: '111 Past Ln',
        accountNumber: 'PAST-111',
        dispatchTarget: '50 kW'
      }],
      rawContent: 'Test past event'
    };

    let jobStarted = false;

    scheduler.on('jobStarted', () => {
      jobStarted = true;
    });

    scheduler.on('jobCompleted', () => {
      expect(jobStarted).toBe(true);
      done();
    });

    scheduler.on('jobFailed', () => {
      expect(jobStarted).toBe(true);
      done();
    });

    scheduler.scheduleDispatchNotifications(pastEvent);
  }, 30000);

  test('should emit events during job lifecycle', (done) => {
    const event: DispatchEvent = {
      messageId: 'test-lifecycle-123',
      subject: 'Lifecycle Test',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() + 1000), // 1 second from now
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/New_York',
      facilities: [{
        companyName: 'Lifecycle Company',
        facilityName: 'Lifecycle Facility',
        address: '222 Life St',
        accountNumber: 'LIFE-222',
        dispatchTarget: '75 kW'
      }],
      rawContent: 'Test lifecycle'
    };

    const events: string[] = [];

    scheduler.on('jobScheduled', () => events.push('scheduled'));
    scheduler.on('jobStarted', () => events.push('started'));
    scheduler.on('jobCompleted', () => {
      events.push('completed');
      expect(events).toContain('scheduled');
      expect(events).toContain('started');
      done();
    });
    scheduler.on('jobFailed', () => {
      events.push('failed');
      expect(events).toContain('scheduled');
      expect(events).toContain('started');
      done();
    });

    scheduler.scheduleDispatchNotifications(event);
  }, 30000);

  test('should cancel jobs successfully', () => {
    const event: DispatchEvent = {
      messageId: 'test-cancel-123',
      subject: 'Cancel Test',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() + 60000), // 1 minute from now
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/New_York',
      facilities: [{
        companyName: 'Cancel Company',
        facilityName: 'Cancel Facility',
        address: '333 Cancel Ct',
        accountNumber: 'CANCEL-333',
        dispatchTarget: '125 kW'
      }],
      rawContent: 'Test cancel'
    };

    scheduler.scheduleDispatchNotifications(event);
    
    const activeJobs = scheduler.getActiveJobs();
    expect(activeJobs.length).toBe(1);
    
    const jobId = activeJobs[0].id;
    const cancelled = scheduler.cancelJob(jobId);
    expect(cancelled).toBe(true);
    
    const jobStatus = scheduler.getJobStatus(jobId);
    expect(jobStatus?.status).toBe('failed');
  });

  test('should track job statistics', () => {
    const event: DispatchEvent = {
      messageId: 'test-stats-123',
      subject: 'Stats Test',
      from: 'test@cpower.com',
      dispatchType: 'Test',
      eventDate: new Date(),
      startTime: new Date(Date.now() + 60000),
      endTime: new Date(Date.now() + 3600000),
      timezone: 'America/New_York',
      facilities: [
        {
          companyName: 'Stats Company 1',
          facilityName: 'Stats Facility 1',
          address: '444 Stats St',
          accountNumber: 'STATS-444',
          dispatchTarget: '175 kW'
        },
        {
          companyName: 'Stats Company 2',
          facilityName: 'Stats Facility 2',
          address: '555 Stats Ave',
          accountNumber: 'STATS-555',
          dispatchTarget: '225 kW'
        }
      ],
      rawContent: 'Test stats'
    };

    scheduler.scheduleDispatchNotifications(event);
    
    const stats = scheduler.getStatistics();
    expect(stats.pending).toBe(2);
    expect(stats.running).toBe(0);
    expect(stats.completed).toBe(0);
    expect(stats.failed).toBe(0);
  });

  test('EmailSender should connect to SMTP', async () => {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.log('Skipping SMTP test - credentials not configured');
      return;
    }

    const connected = await emailSender.testConnection();
    expect(connected).toBe(true);
  });
});
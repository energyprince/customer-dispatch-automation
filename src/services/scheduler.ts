import * as cron from 'node-cron';
import { EventEmitter } from 'events';
import { DispatchEvent } from '../types';
import { ScreenshotService } from './screenshotService';
import { EmailSender } from './emailSender';
import { ExcelService } from './excelService';
import * as fs from 'fs/promises';

interface ScheduledJob {
  id: string;
  facilityName: string;
  dispatchEvent: DispatchEvent;
  scheduledTime: Date;
  task?: cron.ScheduledTask;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export class Scheduler extends EventEmitter {
  private jobs: Map<string, ScheduledJob> = new Map();
  private screenshotService: ScreenshotService;
  private emailSender: EmailSender;
  private excelService: ExcelService;
  private jobCounter: number = 0;

  constructor() {
    super();
    // Services will be initialized later with proper config
    this.emailSender = new EmailSender();
    this.excelService = new ExcelService();
    // Screenshot service requires config, will be created when needed
    this.screenshotService = null as any;
  }

  async initialize(): Promise<void> {
    await this.excelService.initialize();
    console.log('✓ Scheduler initialized');
  }

  scheduleDispatchNotifications(event: DispatchEvent): void {
    console.log(`📅 Scheduling notifications for ${event.facilities.length} facilities`);
    
    const notificationTime = new Date(event.startTime);
    notificationTime.setMinutes(notificationTime.getMinutes() + 10);

    if (notificationTime <= new Date()) {
      console.log('⚠️  Event notification time has already passed, processing immediately');
      this.processAllFacilities(event);
      return;
    }

    const cronExpression = this.dateToCron(notificationTime);
    console.log(`🕑 Notifications scheduled for: ${notificationTime.toLocaleString()}`);

    event.facilities.forEach(facility => {
      const facilityName = facility.facilityName;
      const jobId = `job-${++this.jobCounter}-${facilityName.replace(/[^a-z0-9]/gi, '-')}`;
      
      const task = cron.schedule(cronExpression, async () => {
        await this.processFacility(jobId, facilityName, event);
      }, {
        scheduled: true,
        timezone: event.timezone || process.env.TZ || 'America/New_York'
      });

      const job: ScheduledJob = {
        id: jobId,
        facilityName,
        dispatchEvent: event,
        scheduledTime: notificationTime,
        task,
        status: 'pending'
      };

      this.jobs.set(jobId, job);
      this.emit('jobScheduled', { jobId, facilityName, scheduledTime: notificationTime });
    });

    console.log(`✓ Scheduled ${event.facilities.length} notification jobs`);
  }

  private async processAllFacilities(event: DispatchEvent): Promise<void> {
    console.log(`🚀 Processing ${event.facilities.length} facilities immediately`);
    
    const promises = event.facilities.map(async (facility) => {
      const facilityName = facility.facilityName;
      const jobId = `immediate-${++this.jobCounter}-${facilityName.replace(/[^a-z0-9]/gi, '-')}`;
      await this.processFacility(jobId, facilityName, event);
    });

    await Promise.allSettled(promises);
    console.log('✓ Completed immediate processing of all facilities');
  }

  private async processFacility(jobId: string, facilityName: string, event: DispatchEvent): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'running';
    }

    this.emit('jobStarted', { jobId, facilityName });
    console.log(`🏃 Processing: ${facilityName}`);

    try {
      // Get contacts first
      let contacts = this.excelService.getContactsByFacility(facilityName);
      
      if (contacts.length === 0) {
        const match = this.excelService.findBestMatch(facilityName);
        if (match && match.confidence > 0.8) {
          console.log(`🔍 Using fuzzy match: ${facilityName} -> ${match.facility} (${Math.round(match.confidence * 100)}% confidence)`);
          contacts = this.excelService.getContactsByFacility(match.facility);
        }
      }
      
      let screenshotPath: string | undefined;
      
      try {
        // Create screenshot service with config if not already created
        if (!this.screenshotService) {
          this.screenshotService = new ScreenshotService({
            portalUrl: process.env.PORTAL_URL || '',
            username: process.env.PORTAL_USERNAME || '',
            password: process.env.PORTAL_PASSWORD || ''
          });
        }
        
        await this.screenshotService.initialize();
        
        // For screenshots, use the first contact's name if available
        const firstContact = contacts.length > 0 ? 
          `${contacts[0].firstName} ${contacts[0].lastName}` : undefined;
        
        const capturedPath = await this.screenshotService.captureUsage(
          facilityName, 
          firstContact, 
          event.dispatchType
        );
        
        if (capturedPath) {
          screenshotPath = capturedPath;
          console.log(`✓ Screenshot captured for ${facilityName}`);
        } else {
          console.log(`⚠️  No valid usage data found for ${facilityName}`);
        }
      } catch (screenshotError) {
        console.error(`✗ Screenshot failed for ${facilityName}:`, (screenshotError as Error).message);
      }

      if (contacts.length === 0) {
        console.warn(`⚠️  No contacts found for facility: ${facilityName}`);
        this.emit('noContactsFound', { jobId, facilityName });
      } else {
        console.log(`📧 Sending notifications to ${contacts.length} contacts for ${facilityName}`);
        
        // If TEST_EMAIL is set, override all contact emails
        const testEmail = process.env.TEST_EMAIL;
        const emailPromises = contacts.map(contact => {
          const targetContact = testEmail ? { ...contact, email: testEmail } : contact;
          if (testEmail) {
            console.log(`   📧 Redirecting email for ${contact.firstName} ${contact.lastName} to test address: ${testEmail}`);
          }
          return this.emailSender.sendDispatchNotification(targetContact, event, facilityName, screenshotPath)
            .catch(error => {
              console.error(`Failed to send to ${targetContact.email}:`, error);
              this.emit('emailFailed', { jobId, facilityName, contact: targetContact, error });
            });
        });

        await Promise.allSettled(emailPromises);
      }

      if (screenshotPath && false) { // Disabled for debugging
        try {
          await fs.unlink(screenshotPath!);
          console.log(`🗑️  Cleaned up screenshot for ${facilityName}`);
        } catch (error) {
          console.error(`Failed to delete screenshot:`, error);
        }
      } else if (screenshotPath) {
        console.log(`📸 Screenshot saved at: ${screenshotPath}`);
      }

      if (job) {
        job.status = 'completed';
      }
      this.emit('jobCompleted', { jobId, facilityName });
      console.log(`✓ Completed processing: ${facilityName}`);

    } catch (error) {
      console.error(`✗ Failed to process ${facilityName}:`, (error as Error).message);
      if (job) {
        job.status = 'failed';
      }
      this.emit('jobFailed', { jobId, facilityName, error });
    } finally {
      try {
        if (this.screenshotService) {
          await this.screenshotService.close();
        }
      } catch (error) {
        console.error('Failed to close screenshot service:', error);
      }
    }
  }

  private dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const dayOfWeek = '*';

    return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
  }

  getActiveJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values()).filter(job => job.status === 'pending');
  }

  getJobStatus(jobId: string): ScheduledJob | undefined {
    return this.jobs.get(jobId);
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.task && job.status === 'pending') {
      job.task.stop();
      job.status = 'failed';
      this.emit('jobCancelled', { jobId, facilityName: job.facilityName });
      return true;
    }
    return false;
  }

  cancelAllJobs(): void {
    let cancelledCount = 0;
    this.jobs.forEach((_job, jobId) => {
      if (this.cancelJob(jobId)) {
        cancelledCount++;
      }
    });
    console.log(`🚫 Cancelled ${cancelledCount} pending jobs`);
  }

  getStatistics(): { pending: number; running: number; completed: number; failed: number } {
    const stats = { pending: 0, running: 0, completed: 0, failed: 0 };
    this.jobs.forEach(job => {
      stats[job.status]++;
    });
    return stats;
  }
}

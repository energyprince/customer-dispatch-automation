// IMAP email monitoring service
import { EventEmitter } from 'events';
import * as imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import { CPowerEmailParser } from './cpowerEmailParser';
import { ProcessedEmailTracker } from './processedTracker';

export interface EmailMonitorConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
  checkInterval?: number; // milliseconds
}

export class EmailMonitor extends EventEmitter {
  private config: imaps.ImapSimpleOptions;
  private connection: imaps.ImapSimple | null = null;
  private parser: CPowerEmailParser;
  private tracker: ProcessedEmailTracker;
  private checkInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(config: EmailMonitorConfig, tracker?: ProcessedEmailTracker) {
    super();
    
    // Configure IMAP connection
    this.config = {
      imap: {
        user: config.user,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        authTimeout: 10000,
        tlsOptions: { 
          rejectUnauthorized: false,
          servername: config.host
        }
      }
    };

    this.checkInterval = config.checkInterval || 30000; // Default 30 seconds
    this.parser = new CPowerEmailParser();
    this.tracker = tracker || new ProcessedEmailTracker();
  }

  // Connect to IMAP server
  async connect(): Promise<void> {
    try {
      console.log(`Connecting to ${this.config.imap.host}...`);
      this.connection = await imaps.connect(this.config);
      console.log('✓ Connected to email server');
      
      // Initialize tracker if needed
      await this.tracker.initialize();
    } catch (error) {
      console.error('Failed to connect to email server:', error);
      throw error;
    }
  }

  // Start monitoring for new emails
  async startMonitoring(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to email server. Call connect() first.');
    }

    if (this.isMonitoring) {
      console.log('Already monitoring emails');
      return;
    }

    this.isMonitoring = true;
    console.log(`Starting email monitoring (checking every ${this.checkInterval / 1000} seconds)`);

    // Check immediately
    await this.checkForNewEmails();

    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isMonitoring) {
        await this.checkForNewEmails();
      }
    }, this.checkInterval);
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
    console.log('Stopped email monitoring');
  }

  // Check for new emails
  private async checkForNewEmails(): Promise<void> {
    if (!this.connection) return;

    try {
      // Open inbox
      await this.connection.openBox('INBOX');

      // Search for unread emails
      const searchCriteria = ['UNSEEN'];
      const fetchOptions = {
        bodies: ['HEADER', 'TEXT', ''],
        markSeen: false // Don't mark as read yet
      };

      const messages = await this.connection.search(searchCriteria, fetchOptions);
      
      if (messages.length === 0) {
        return;
      }

      console.log(`Found ${messages.length} unread email(s)`);

      // Process each message
      for (const message of messages) {
        await this.processMessage(message);
      }
    } catch (error) {
      console.error('Error checking emails:', error);
      // Try to reconnect if connection was lost
      const err = error as any;
      if (err.message?.includes('connection') || err.code === 'ECONNRESET') {
        await this.reconnect();
      }
    }
  }

  // Process a single message
  private async processMessage(message: any): Promise<void> {
    try {
      // Get email UID
      const uid = message.attributes.uid;
      
      // Build raw email content
      const rawEmail = this.buildRawEmail(message);
      
      // Parse email to get basic info
      const parsed = await simpleParser(rawEmail);
      const messageId = parsed.messageId || `uid-${uid}`;
      const subject = parsed.subject || '';
      const from = parsed.from?.text || '';
      
      // Check if already processed
      const isProcessed = await this.tracker.isProcessed(messageId, rawEmail);
      if (isProcessed) {
        // Mark as read since we've already processed it
        await this.markAsRead(uid);
        return;
      }

      // Check if it's a dispatch email
      const dispatchEvent = await this.parser.parseEmailContent(rawEmail);
      
      if (dispatchEvent) {
        console.log(`📧 New dispatch email received: ${subject}`);
        console.log(`   From: ${from}`);
        console.log(`   Type: ${dispatchEvent.dispatchType}`);
        console.log(`   Facilities: ${dispatchEvent.facilities.length}`);
        
        // Mark as processed
        await this.tracker.markAsProcessed(messageId, subject, from, rawEmail);
        
        // Mark as read
        await this.markAsRead(uid);
        
        // Emit event
        this.emit('dispatch', dispatchEvent);
      } else {
        // Not a dispatch email, but we can still mark it as read
        // if it's from CPower to keep inbox clean
        if (from.toLowerCase().includes('cpower')) {
          await this.markAsRead(uid);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  }

  // Build raw email from IMAP message parts
  private buildRawEmail(message: any): string {
    let raw = '';
    
    // Add headers
    if (message.header) {
      raw += message.header;
    }
    
    // Add body
    if (message.body) {
      raw += '\r\n\r\n' + message.body;
    }
    
    // If we have the full message, use that
    if (message['']) {
      raw = message[''];
    }
    
    return raw;
  }

  // Mark email as read
  private async markAsRead(uid: number): Promise<void> {
    if (!this.connection) return;
    
    try {
      await this.connection.addFlags(uid, '\\Seen');
    } catch (error) {
      console.error('Error marking email as read:', error);
    }
  }

  // Reconnect to server
  private async reconnect(): Promise<void> {
    console.log('Attempting to reconnect...');
    try {
      if (this.connection) {
        try {
          await this.connection.end();
        } catch (error) {
          // Ignore errors when closing
        }
      }
      
      this.connection = null;
      await this.connect();
      
      if (this.isMonitoring) {
        console.log('Resuming monitoring after reconnection');
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
      // Will retry on next interval
    }
  }

  // Disconnect from server
  async disconnect(): Promise<void> {
    this.stopMonitoring();
    
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('Disconnected from email server');
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
      this.connection = null;
    }
  }

  // Get monitoring status
  getStatus(): {
    connected: boolean;
    monitoring: boolean;
    lastCheck?: Date;
  } {
    return {
      connected: this.connection !== null,
      monitoring: this.isMonitoring
    };
  }

  // Manually trigger email check
  async checkNow(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected to email server');
    }
    
    console.log('Manually checking for new emails...');
    await this.checkForNewEmails();
  }
}

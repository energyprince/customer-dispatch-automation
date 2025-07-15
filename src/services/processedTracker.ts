// Service to track processed emails
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

interface ProcessedEmail {
  messageId: string;
  contentHash: string;
  processedAt: Date;
  subject: string;
  from: string;
}

export class ProcessedEmailTracker {
  private filePath: string;
  private processed: Map<string, ProcessedEmail>;

  constructor(filePath: string = 'processed-emails.json') {
    this.filePath = path.resolve(filePath);
    this.processed = new Map();
  }

  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const entries: ProcessedEmail[] = JSON.parse(data);
      
      // Load existing entries into map
      entries.forEach(entry => {
        this.processed.set(entry.messageId, {
          ...entry,
          processedAt: new Date(entry.processedAt)
        });
      });

      // Clean old entries (older than 30 days)
      await this.cleanOldEntries();
    } catch (error) {
      // File doesn't exist yet, that's okay
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error loading processed emails:', error);
      }
    }
  }

  async isProcessed(messageId: string, content: string): Promise<boolean> {
    // Check by message ID
    if (this.processed.has(messageId)) {
      return true;
    }

    // Check by content hash (catches forwarded emails)
    const contentHash = this.generateHash(content);
    for (const entry of this.processed.values()) {
      if (entry.contentHash === contentHash) {
        return true;
      }
    }

    return false;
  }

  async markAsProcessed(
    messageId: string,
    subject: string,
    from: string,
    content: string
  ): Promise<void> {
    const contentHash = this.generateHash(content);
    
    const entry: ProcessedEmail = {
      messageId,
      contentHash,
      processedAt: new Date(),
      subject,
      from
    };

    this.processed.set(messageId, entry);
    await this.save();
  }

  private generateHash(content: string): string {
    return crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');
  }

  private async cleanOldEntries(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let cleaned = 0;
    for (const [messageId, entry] of this.processed.entries()) {
      if (entry.processedAt < thirtyDaysAgo) {
        this.processed.delete(messageId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} old processed email entries`);
      await this.save();
    }
  }

  private async save(): Promise<void> {
    const entries = Array.from(this.processed.values());
    const json = JSON.stringify(entries, null, 2);
    
    // Write to temp file first, then rename (atomic operation)
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, json, 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }

  // Get statistics about processed emails
  getStats(): { total: number; oldestDate: Date | null; newestDate: Date | null } {
    const entries = Array.from(this.processed.values());
    
    if (entries.length === 0) {
      return { total: 0, oldestDate: null, newestDate: null };
    }

    const dates = entries.map(e => e.processedAt);
    dates.sort((a, b) => a.getTime() - b.getTime());

    return {
      total: entries.length,
      oldestDate: dates[0],
      newestDate: dates[dates.length - 1]
    };
  }

  // For testing purposes
  async reset(): Promise<void> {
    this.processed.clear();
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      // File might not exist, that's okay
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

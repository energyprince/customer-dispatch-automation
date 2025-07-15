// Tests for processed email tracker
import { ProcessedEmailTracker } from '../../services/processedTracker';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ProcessedEmailTracker', () => {
  const testFilePath = 'test-processed-emails.json';
  let tracker: ProcessedEmailTracker;

  beforeEach(async () => {
    tracker = new ProcessedEmailTracker(testFilePath);
    await tracker.reset();
  });

  afterEach(async () => {
    try {
      await fs.unlink(path.resolve(testFilePath));
    } catch (error) {
      // File might not exist, that's okay
    }
  });

  describe('initialize', () => {
    it('should initialize with empty state when file does not exist', async () => {
      await tracker.initialize();
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
    });

    it('should load existing data from file', async () => {
      // Create a file with test data
      const testData = [
        {
          messageId: 'test123',
          contentHash: 'hash123',
          processedAt: new Date().toISOString(),
          subject: 'Test Email',
          from: 'test@example.com'
        }
      ];
      await fs.writeFile(testFilePath, JSON.stringify(testData));

      await tracker.initialize();
      const stats = tracker.getStats();
      expect(stats.total).toBe(1);
    });
  });

  describe('isProcessed', () => {
    it('should return false for unprocessed email', async () => {
      await tracker.initialize();
      const result = await tracker.isProcessed('new123', 'new content');
      expect(result).toBe(false);
    });

    it('should return true for processed email by messageId', async () => {
      await tracker.initialize();
      await tracker.markAsProcessed(
        'msg123',
        'Test Subject',
        'sender@example.com',
        'Email content'
      );

      const result = await tracker.isProcessed('msg123', 'different content');
      expect(result).toBe(true);
    });

    it('should return true for processed email by content hash', async () => {
      await tracker.initialize();
      const content = 'Email content';
      await tracker.markAsProcessed(
        'msg123',
        'Test Subject',
        'sender@example.com',
        content
      );

      // Different messageId but same content (forwarded email)
      const result = await tracker.isProcessed('msg456', content);
      expect(result).toBe(true);
    });
  });

  describe('markAsProcessed', () => {
    it('should mark email as processed and persist to file', async () => {
      await tracker.initialize();
      
      await tracker.markAsProcessed(
        'msg789',
        'Dispatch Alert',
        'cpower@example.com',
        'Dispatch content'
      );

      // Verify it's marked as processed
      const isProcessed = await tracker.isProcessed('msg789', 'any content');
      expect(isProcessed).toBe(true);

      // Verify it's persisted to file
      const fileContent = await fs.readFile(path.resolve(testFilePath), 'utf-8');
      const data = JSON.parse(fileContent);
      expect(data).toHaveLength(1);
      expect(data[0].messageId).toBe('msg789');
      expect(data[0].subject).toBe('Dispatch Alert');
    });
  });

  describe('cleanOldEntries', () => {
    it('should remove entries older than 30 days', async () => {
      // Create old entry
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 31);
      
      const testData = [
        {
          messageId: 'old123',
          contentHash: 'oldhash',
          processedAt: oldDate.toISOString(),
          subject: 'Old Email',
          from: 'old@example.com'
        },
        {
          messageId: 'new123',
          contentHash: 'newhash',
          processedAt: new Date().toISOString(),
          subject: 'New Email',
          from: 'new@example.com'
        }
      ];
      await fs.writeFile(testFilePath, JSON.stringify(testData));

      await tracker.initialize(); // This triggers cleanup
      const stats = tracker.getStats();
      expect(stats.total).toBe(1); // Only new email should remain
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await tracker.initialize();
      
      await tracker.markAsProcessed('msg1', 'Subject 1', 'from1@example.com', 'content1');
      await tracker.markAsProcessed('msg2', 'Subject 2', 'from2@example.com', 'content2');
      
      const stats = tracker.getStats();
      expect(stats.total).toBe(2);
      expect(stats.oldestDate).toBeDefined();
      expect(stats.newestDate).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should clear all data and delete file', async () => {
      await tracker.initialize();
      await tracker.markAsProcessed('msg1', 'Subject', 'from@example.com', 'content');
      
      await tracker.reset();
      
      const stats = tracker.getStats();
      expect(stats.total).toBe(0);
      
      // File should not exist
      await expect(fs.access(path.resolve(testFilePath))).rejects.toThrow();
    });
  });
});
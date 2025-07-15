// Example usage of ProcessedEmailTracker
import { ProcessedEmailTracker } from '../services/processedTracker';

async function demonstrateTracker() {
  console.log('=== ProcessedEmailTracker Demo ===\n');

  // Create tracker instance
  const tracker = new ProcessedEmailTracker();
  await tracker.initialize();

  // Example email data
  const email1 = {
    messageId: 'cpower-12345@mg.cpowerenergymanagement.com',
    subject: 'URGENT: RI Energy - RI Energy Targeted Event',
    from: 'cpowerdispatch@mg.cpowerenergymanagement.com',
    content: 'Internal Notification for the event just dispatched for RI Energy...'
  };

  const email2 = {
    messageId: 'cpower-12346@mg.cpowerenergymanagement.com',
    subject: 'URGENT: RI Energy - Another Event',
    from: 'cpowerdispatch@mg.cpowerenergymanagement.com',
    content: 'Different dispatch content...'
  };

  // Check if email1 is already processed
  console.log('1. Checking if email1 is processed:');
  let isProcessed = await tracker.isProcessed(email1.messageId, email1.content);
  console.log(`   Result: ${isProcessed ? 'YES (skip)' : 'NO (process it)'}\n`);

  // Mark email1 as processed
  if (!isProcessed) {
    console.log('2. Marking email1 as processed...');
    await tracker.markAsProcessed(
      email1.messageId,
      email1.subject,
      email1.from,
      email1.content
    );
    console.log('   Done!\n');
  }

  // Check again - should be processed now
  console.log('3. Checking email1 again:');
  isProcessed = await tracker.isProcessed(email1.messageId, email1.content);
  console.log(`   Result: ${isProcessed ? 'YES (skip)' : 'NO (process it)'}\n`);

  // Simulate forwarded email (same content, different ID)
  console.log('4. Checking forwarded email (same content, different ID):');
  const forwardedId = 'forwarded-12345@example.com';
  isProcessed = await tracker.isProcessed(forwardedId, email1.content);
  console.log(`   Result: ${isProcessed ? 'YES (duplicate content!)' : 'NO'}\n`);

  // Check different email
  console.log('5. Checking email2:');
  isProcessed = await tracker.isProcessed(email2.messageId, email2.content);
  console.log(`   Result: ${isProcessed ? 'YES' : 'NO (new email)'}\n`);

  // Get statistics
  console.log('6. Tracker Statistics:');
  const stats = tracker.getStats();
  console.log(`   Total processed: ${stats.total}`);
  if (stats.oldestDate) {
    console.log(`   Oldest: ${stats.oldestDate.toLocaleString()}`);
    console.log(`   Newest: ${stats.newestDate?.toLocaleString()}`);
  }

  console.log('\n=== Demo Complete ===');
}

// Run the demo
if (require.main === module) {
  demonstrateTracker().catch(console.error);
}
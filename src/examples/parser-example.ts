// Example usage of CPowerEmailParser
import { CPowerEmailParser } from '../services/cpowerEmailParser';
import * as path from 'path';

async function demonstrateParser() {
  console.log('=== CPowerEmailParser Demo ===\n');

  const parser = new CPowerEmailParser();
  
  // Path to sample email
  const emailPath = path.join(
    __dirname, 
    'Dispatched Event Internal Notification for_ National Grid Targeted Dispatch Event - Tuesday, June 24, 2025.eml'
  );

  console.log('1. Parsing dispatch email...');
  const dispatchEvent = await parser.parseEmailFile(emailPath);

  if (!dispatchEvent) {
    console.error('Failed to parse email!');
    return;
  }

  console.log('   ✓ Successfully parsed!\n');

  // Display basic info
  console.log('2. Email Details:');
  console.log(`   Subject: ${dispatchEvent.subject}`);
  console.log(`   From: ${dispatchEvent.from}`);
  console.log(`   Message ID: ${dispatchEvent.messageId}\n`);

  // Display dispatch info
  console.log('3. Dispatch Information:');
  console.log(`   Type: ${dispatchEvent.dispatchType}`);
  console.log(`   Date: ${dispatchEvent.eventDate.toLocaleDateString()}`);
  console.log(`   Start: ${dispatchEvent.startTime.toLocaleTimeString()} ${dispatchEvent.timezone}`);
  console.log(`   End: ${dispatchEvent.endTime.toLocaleTimeString()} ${dispatchEvent.timezone}`);
  console.log(`   Total Facilities: ${dispatchEvent.facilities.length}\n`);

  // Show first 5 facilities
  console.log('4. First 5 Facilities:');
  dispatchEvent.facilities.slice(0, 5).forEach((facility, index) => {
    console.log(`   ${index + 1}. ${facility.facilityName}`);
    console.log(`      Company: ${facility.companyName}`);
    console.log(`      Address: ${facility.address}`);
    console.log(`      Account: ${facility.accountNumber}`);
    console.log(`      Target: ${facility.dispatchTarget}`);
    console.log('');
  });

  // Show facilities by company
  console.log('5. Facilities by Company:');
  const companyCounts = new Map<string, number>();
  dispatchEvent.facilities.forEach(facility => {
    const count = companyCounts.get(facility.companyName) || 0;
    companyCounts.set(facility.companyName, count + 1);
  });

  const sortedCompanies = Array.from(companyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  sortedCompanies.forEach(([company, count]) => {
    console.log(`   ${company}: ${count} facilities`);
  });

  // Generate summary
  console.log('\n6. Event Summary:');
  console.log(`   ${parser.getSummary(dispatchEvent)}`);

  // Calculate notification time (10 minutes after start)
  const notificationTime = new Date(dispatchEvent.startTime);
  notificationTime.setMinutes(notificationTime.getMinutes() + 10);
  console.log(`\n7. Notifications will be sent at: ${notificationTime.toLocaleTimeString()} ${dispatchEvent.timezone}`);

  console.log('\n=== Demo Complete ===');
}

// Run the demo
if (require.main === module) {
  demonstrateParser().catch(console.error);
}
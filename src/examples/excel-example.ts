// Example usage of ExcelService
import { ExcelService } from '../services/excelService';

async function demonstrateExcelService() {
  console.log('=== ExcelService Demo ===\n');

  const excelService = new ExcelService();

  console.log('1. Loading Excel file...');
  await excelService.initialize();
  console.log('   ✓ Excel loaded successfully!\n');

  // Get statistics
  console.log('2. Excel Statistics:');
  const stats = excelService.getStats();
  console.log(`   Total Facilities: ${stats.totalFacilities}`);
  console.log(`   Total Contacts: ${stats.totalContacts}`);
  console.log(`   Facilities with Multiple Contacts: ${stats.facilitiesWithMultipleContacts}`);
  console.log(`   Average Contacts per Facility: ${stats.averageContactsPerFacility.toFixed(2)}\n`);

  // Show some facilities
  console.log('3. Sample Facilities (first 10):');
  const facilities = excelService.getAllFacilities();
  facilities.slice(0, 10).forEach((facility, index) => {
    const contacts = excelService.getContactsByFacility(facility);
    console.log(`   ${index + 1}. ${facility} (${contacts.length} contacts)`);
  });

  // Test facility lookup
  console.log('\n4. Looking up specific facilities:');
  
  // Test 1: Exact match
  const testFacility1 = 'Rhode Island Hospital';
  console.log(`\n   a) Searching for: "${testFacility1}"`);
  const contacts1 = excelService.getContactsByFacility(testFacility1);
  console.log(`      Found ${contacts1.length} contacts:`);
  contacts1.slice(0, 3).forEach(contact => {
    console.log(`      - ${contact.firstName} ${contact.lastName} <${contact.email}>`);
  });
  if (contacts1.length > 3) {
    console.log(`      ... and ${contacts1.length - 3} more`);
  }

  // Test 2: Case insensitive
  const testFacility2 = 'bj\'s wholesale club isone 393';
  console.log(`\n   b) Searching for: "${testFacility2}" (lowercase)`);
  const contacts2 = excelService.getContactsByFacility(testFacility2);
  console.log(`      Found ${contacts2.length} contacts`);

  // Test 3: Partial match
  const testFacility3 = 'Brown University';
  console.log(`\n   c) Searching for: "${testFacility3}" (partial)`);
  const contacts3 = excelService.getContactsByFacility(testFacility3);
  console.log(`      Found ${contacts3.length} contacts from facilities containing "Brown University"`);

  // Test best match functionality
  console.log('\n5. Testing fuzzy matching:');
  const searches = [
    'Rhode Island Hosp',
    'BJs Wholesale',
    'Home Depot',
    'Walmart',
    'XYZ Random Facility'
  ];

  searches.forEach(search => {
    const match = excelService.findBestMatch(search);
    if (match) {
      console.log(`   "${search}" → "${match.facility}" (confidence: ${(match.confidence * 100).toFixed(0)}%)`);
    } else {
      console.log(`   "${search}" → No match found`);
    }
  });

  // Show contacts by dispatchable status
  console.log('\n6. Contacts by Dispatchable Status:');
  let dispatchableCount = 0;
  let nonDispatchableCount = 0;
  
  facilities.forEach(facility => {
    const contacts = excelService.getContactsByFacility(facility);
    contacts.forEach(contact => {
      if (contact.dispatchable) {
        dispatchableCount++;
      } else {
        nonDispatchableCount++;
      }
    });
  });

  console.log(`   Dispatchable: ${dispatchableCount}`);
  console.log(`   Non-dispatchable: ${nonDispatchableCount}`);

  // Integration example with parser
  console.log('\n7. Integration Example:');
  console.log('   When a dispatch email arrives with these facilities:');
  const dispatchFacilities = [
    'Rhode Island Hospital',
    'BJ\'s Wholesale Club ISONE 393',
    'Brown University 222 Richmond St'
  ];

  let totalContacts = 0;
  dispatchFacilities.forEach(facility => {
    const contacts = excelService.getContactsByFacility(facility);
    console.log(`   - ${facility}: ${contacts.length} contacts to notify`);
    totalContacts += contacts.length;
  });
  console.log(`   Total notifications to send: ${totalContacts}`);

  console.log('\n=== Demo Complete ===');
}

// Run the demo
if (require.main === module) {
  demonstrateExcelService().catch(console.error);
}
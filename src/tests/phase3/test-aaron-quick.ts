import * as dotenv from 'dotenv';
import * as path from 'path';
import { CPowerEmailParser } from '../../services/cpowerEmailParser';
import { ExcelService } from '../../services/excelService';

dotenv.config();

async function quickTest() {
  console.log('=== Quick Aaron Industries Test ===\n');

  try {
    // Test Excel Service
    console.log('1. Testing Excel Service...');
    const excelService = new ExcelService();
    await excelService.initialize();
    console.log('   ✓ Excel loaded successfully');
    
    // Test Parser
    console.log('\n2. Testing Email Parser...');
    const parser = new CPowerEmailParser();
    const emailPath = path.join(
      process.cwd(),
      'data',
      'Dispatched Event Internal Notification for_ National Grid Targeted Dispatch Event - Tuesday, June 24, 2025.eml'
    );
    
    const dispatchEvent = await parser.parseEmailFile(emailPath);
    if (!dispatchEvent) {
      console.error('   ✗ Failed to parse email');
      return;
    }
    
    console.log('   ✓ Email parsed successfully');
    console.log(`   Facilities: ${dispatchEvent.facilities.length}`);
    
    // Find Aaron Industries
    const aaron = dispatchEvent.facilities.find(f => 
      f.facilityName.toLowerCase().includes('aaron')
    );
    
    if (aaron) {
      console.log(`\n3. Found: ${aaron.facilityName}`);
      console.log(`   Company: ${aaron.companyName}`);
      console.log(`   Target: ${aaron.dispatchTarget}`);
      
      // Check contacts
      const contacts = excelService.getContactsByFacility(aaron.facilityName);
      console.log(`   Contacts: ${contacts.length}`);
      
      if (contacts.length > 0) {
        contacts.forEach(c => {
          console.log(`   - ${c.firstName} ${c.lastName} (${c.email})`);
        });
      }
    } else {
      console.log('\n✗ Aaron Industries not found');
    }
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
    console.error(error);
  }
}

quickTest();
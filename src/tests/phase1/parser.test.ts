// Tests for CPower email parser
import { CPowerEmailParser } from '../../services/cpowerEmailParser';
import * as path from 'path';

describe('CPowerEmailParser', () => {
  let parser: CPowerEmailParser;
  const sampleEmailPath = path.join(
    __dirname, 
    '../../examples/Dispatched Event Internal Notification for_ National Grid Targeted Dispatch Event - Tuesday, June 24, 2025.eml'
  );

  beforeEach(() => {
    parser = new CPowerEmailParser();
  });

  describe('parseEmailFile', () => {
    it('should parse the sample dispatch email', async () => {
      const result = await parser.parseEmailFile(sampleEmailPath);
      
      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      
      if (result) {
        // Check basic email properties
        expect(result.messageId).toBeTruthy();
        expect(result.subject).toContain('National Grid Targeted Dispatch');
        expect(result.from).toContain('cpowerdispatch');
        
        // Check dispatch details
        expect(result.dispatchType).toBe('National Grid - Targeted Dispatch');
        expect(result.timezone).toBe('EDT');
        
        // Check event times
        expect(result.startTime).toBeInstanceOf(Date);
        expect(result.endTime).toBeInstanceOf(Date);
        
        // Check that we have facilities
        expect(result.facilities).toBeInstanceOf(Array);
        expect(result.facilities.length).toBeGreaterThan(0);
      }
    });

    it('should extract correct event times', async () => {
      const result = await parser.parseEmailFile(sampleEmailPath);
      
      if (result) {
        // Event should be on June 24, 2025
        expect(result.eventDate.getFullYear()).toBe(2025);
        expect(result.eventDate.getMonth()).toBe(5); // June is month 5 (0-indexed)
        expect(result.eventDate.getDate()).toBe(24);
        
        // Start time should be 5:00 PM
        expect(result.startTime.getHours()).toBe(21); // 5 PM + 4 hours (EDT to UTC)
        expect(result.startTime.getMinutes()).toBe(0);
        
        // End time should be 8:00 PM
        expect(result.endTime.getHours()).toBe(0); // 8 PM + 4 hours = midnight next day
        expect(result.endTime.getMinutes()).toBe(0);
      }
    });

    it('should extract facilities correctly', async () => {
      const result = await parser.parseEmailFile(sampleEmailPath);
      
      if (result && result.facilities.length > 0) {
        const firstFacility = result.facilities[0];
        
        // Check facility structure
        expect(firstFacility).toHaveProperty('companyName');
        expect(firstFacility).toHaveProperty('facilityName');
        expect(firstFacility).toHaveProperty('address');
        expect(firstFacility).toHaveProperty('accountNumber');
        expect(firstFacility).toHaveProperty('dispatchTarget');
        
        // Check that values are populated
        expect(firstFacility.companyName).toBeTruthy();
        expect(firstFacility.facilityName).toBeTruthy();
        expect(firstFacility.address).toBeTruthy();
        expect(firstFacility.accountNumber).toBeTruthy();
        expect(firstFacility.dispatchTarget).toBeTruthy();
      }
    });

    it('should find specific facilities', async () => {
      const result = await parser.parseEmailFile(sampleEmailPath);
      
      if (result) {
        // Look for BJ's Wholesale Club facilities
        const bjsFacilities = result.facilities.filter(f => 
          f.companyName.includes("BJ's Wholesale Club")
        );
        
        expect(bjsFacilities.length).toBeGreaterThan(0);
        
        // Check one specific BJ's facility
        const bjs001 = bjsFacilities.find(f => 
          f.facilityName.includes('ISONE 001')
        );
        
        expect(bjs001).toBeDefined();
        if (bjs001) {
          expect(bjs001.address).toContain('Medford MA');
        }
      }
    });
  });

  describe('getSummary', () => {
    it('should generate a readable summary', async () => {
      const result = await parser.parseEmailFile(sampleEmailPath);
      
      if (result) {
        const summary = parser.getSummary(result);
        
        expect(summary).toContain('National Grid - Targeted Dispatch');
        expect(summary).toContain('June 24, 2025');
        expect(summary).toMatch(/affecting \d+ facilities/);
      }
    });
  });

  describe('isDispatchEmail', () => {
    it('should identify dispatch emails correctly', () => {
      // Access private method through any type casting for testing
      const isDispatch = (parser as any).isDispatchEmail;
      
      // Valid dispatch emails
      expect(isDispatch.call(parser, 
        'URGENT: National Grid - Targeted Dispatch Event',
        'CPower Dispatch <cpowerdispatch@mg.cpowerenergymanagement.com>'
      )).toBe(true);
      
      expect(isDispatch.call(parser,
        'Dispatched Event Internal Notification',
        'cpowerdispatch@mg.cpowerenergymanagement.com'
      )).toBe(true);
      
      // Non-dispatch emails
      expect(isDispatch.call(parser,
        'Regular email subject',
        'someone@example.com'
      )).toBe(false);
      
      expect(isDispatch.call(parser,
        'Dispatch notice',
        'notcpower@example.com'
      )).toBe(false);
    });
  });
});
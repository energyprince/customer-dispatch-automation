// Tests for Excel service
import { ExcelService } from '../../services/excelService';
import * as path from 'path';

describe('ExcelService', () => {
  let excelService: ExcelService;
  const excelPath = path.join(process.cwd(), 'data', 'Facility Contact List.xlsx');

  beforeEach(() => {
    excelService = new ExcelService(excelPath);
  });

  describe('initialize', () => {
    it('should load the Excel file successfully', async () => {
      await excelService.initialize();
      
      const stats = excelService.getStats();
      expect(stats.totalFacilities).toBeGreaterThan(0);
      expect(stats.totalContacts).toBeGreaterThan(0);
    });

    it('should throw error for non-existent file', async () => {
      const badService = new ExcelService('non-existent.xlsx');
      await expect(badService.initialize()).rejects.toThrow('Failed to load Excel file');
    });
  });

  describe('getContactsByFacility', () => {
    beforeEach(async () => {
      await excelService.initialize();
    });

    it('should find contacts for exact facility match', () => {
      // Test with a known facility from the Excel
      const contacts = excelService.getContactsByFacility('Rhode Island Hospital');
      
      expect(contacts).toBeInstanceOf(Array);
      if (contacts.length > 0) {
        expect(contacts[0]).toHaveProperty('email');
        expect(contacts[0]).toHaveProperty('facility');
        expect(contacts[0].facility).toBe('Rhode Island Hospital');
      }
    });

    it('should find contacts with case-insensitive match', () => {
      const contacts1 = excelService.getContactsByFacility('Rhode Island Hospital');
      const contacts2 = excelService.getContactsByFacility('rhode island hospital');
      
      expect(contacts1.length).toBe(contacts2.length);
    });

    it('should find contacts with partial match', () => {
      const contacts = excelService.getContactsByFacility('Rhode Island');
      
      expect(contacts.length).toBeGreaterThan(0);
      // Should include Rhode Island Hospital contacts
      expect(contacts.some(c => c.facility.includes('Rhode Island'))).toBe(true);
    });

    it('should return empty array for non-existent facility', () => {
      const contacts = excelService.getContactsByFacility('Non Existent Facility XYZ');
      expect(contacts).toEqual([]);
    });
  });

  describe('getAllFacilities', () => {
    beforeEach(async () => {
      await excelService.initialize();
    });

    it('should return sorted list of facilities', () => {
      const facilities = excelService.getAllFacilities();
      
      expect(facilities).toBeInstanceOf(Array);
      expect(facilities.length).toBeGreaterThan(0);
      
      // Check if sorted
      const sorted = [...facilities].sort();
      expect(facilities).toEqual(sorted);
    });
  });

  describe('getStats', () => {
    beforeEach(async () => {
      await excelService.initialize();
    });

    it('should return correct statistics', () => {
      const stats = excelService.getStats();
      
      expect(stats).toHaveProperty('totalFacilities');
      expect(stats).toHaveProperty('totalContacts');
      expect(stats).toHaveProperty('facilitiesWithMultipleContacts');
      expect(stats).toHaveProperty('averageContactsPerFacility');
      
      expect(stats.totalFacilities).toBeGreaterThan(0);
      expect(stats.totalContacts).toBeGreaterThan(0);
      expect(stats.averageContactsPerFacility).toBeGreaterThan(0);
    });
  });

  describe('findBestMatch', () => {
    beforeEach(async () => {
      await excelService.initialize();
    });

    it('should find exact matches with confidence 1.0', () => {
      const match = excelService.findBestMatch('Rhode Island Hospital');
      
      expect(match).toBeDefined();
      if (match) {
        expect(match.facility).toBe('Rhode Island Hospital');
        expect(match.confidence).toBe(1.0);
      }
    });

    it('should find partial matches with lower confidence', () => {
      const match = excelService.findBestMatch('BJs Wholesale');
      
      expect(match).toBeDefined();
      if (match) {
        expect(match.facility).toContain('BJ');
        expect(match.confidence).toBeGreaterThan(0.5);
        expect(match.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('should return null for poor matches', () => {
      const match = excelService.findBestMatch('XYZ Random String');
      expect(match).toBeNull();
    });
  });

  describe('contact structure', () => {
    beforeEach(async () => {
      await excelService.initialize();
    });

    it('should have correct contact properties', () => {
      const facilities = excelService.getAllFacilities();
      if (facilities.length > 0) {
        const contacts = excelService.getContactsByFacility(facilities[0]);
        
        if (contacts.length > 0) {
          const contact = contacts[0];
          
          expect(contact).toHaveProperty('facility');
          expect(contact).toHaveProperty('company');
          expect(contact).toHaveProperty('firstName');
          expect(contact).toHaveProperty('lastName');
          expect(contact).toHaveProperty('email');
          expect(contact).toHaveProperty('dispatchable');
          
          expect(typeof contact.dispatchable).toBe('boolean');
        }
      }
    });
  });
});
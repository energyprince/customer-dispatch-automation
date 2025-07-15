// Excel file service for reading facility contacts
import { Contact } from '../types';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs/promises';

export class ExcelService {
  private workbook: ExcelJS.Workbook | null = null;
  private contacts: Map<string, Contact[]> = new Map();
  private filePath: string;
  private lastModified: Date | null = null;

  constructor(filePath?: string) {
    // Default to data folder, but allow override
    this.filePath = filePath || path.join(process.cwd(), 'data', 'Facility Contact List.xlsx');
  }

  // Initialize by loading the Excel file
  async initialize(): Promise<void> {
    try {
      console.log(`Loading Excel file from: ${this.filePath}`);
      
      // Check if file exists
      const stats = await fs.stat(this.filePath);
      this.lastModified = stats.mtime;

      // Load workbook
      this.workbook = new ExcelJS.Workbook();
      await this.workbook.xlsx.readFile(this.filePath);

      // Parse contacts
      this.parseContacts();
      
      console.log(`✓ Loaded ${this.contacts.size} facilities with contacts`);
    } catch (error) {
      console.error('Error loading Excel file:', error);
      throw new Error(`Failed to load Excel file: ${this.filePath}`);
    }
  }

  // Parse contacts from the workbook
  private parseContacts(): void {
    if (!this.workbook) return;

    this.contacts.clear();

    // Get the first worksheet
    const worksheet = this.workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('No worksheets found in Excel file');
    }

    // Find header row (assuming it's the first row)
    const headerRow = worksheet.getRow(1);
    const headers: { [key: string]: number } = {};
    
    headerRow.eachCell((cell, colNumber) => {
      const value = String(cell.value || '').toLowerCase().trim();
      headers[value] = colNumber;
    });

    // Validate required columns exist
    const requiredColumns = ['facility', 'email'];
    for (const col of requiredColumns) {
      if (!headers[col]) {
        throw new Error(`Required column "${col}" not found in Excel file`);
      }
    }

    // Map column names to our expected format
    const columnMap = {
      'facility': headers['facility'],
      'company': headers['company'] || headers['acc'],
      'firstName': headers['first name'] || headers['firstname'],
      'lastName': headers['last name'] || headers['lastname'],
      'email': headers['email'] || headers['e-mail'],
      'phone': headers['phone'],
      'cell': headers['cell'] || headers['mobile'],
      'dispatchable': headers['dispatchable']
    };

    // Process each row (skip header)
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      
      // Skip empty rows
      if (!row.hasValues) continue;

      const facility = this.getCellValue(row, columnMap.facility);
      const email = this.getCellValue(row, columnMap.email);

      // Skip rows without facility or email
      if (!facility || !email) continue;

      const contact: Contact = {
        facility,
        company: this.getCellValue(row, columnMap.company) || '',
        firstName: this.getCellValue(row, columnMap.firstName) || '',
        lastName: this.getCellValue(row, columnMap.lastName) || '',
        email,
        phone: this.getCellValue(row, columnMap.phone),
        cell: this.getCellValue(row, columnMap.cell),
        dispatchable: this.getCellValue(row, columnMap.dispatchable)?.toLowerCase() === 't' || 
                      this.getCellValue(row, columnMap.dispatchable)?.toLowerCase() === 'true'
      };

      // Add to facility contacts
      if (!this.contacts.has(facility)) {
        this.contacts.set(facility, []);
      }
      
      // Only add if email is unique for this facility
      const facilityContacts = this.contacts.get(facility)!;
      if (!facilityContacts.some(c => c.email === contact.email)) {
        facilityContacts.push(contact);
      }
    }
  }

  // Helper to safely get cell value as string
  private getCellValue(row: ExcelJS.Row, colNumber: number | undefined): string {
    if (!colNumber) return '';
    const cell = row.getCell(colNumber);
    return String(cell.value || '').trim();
  }

  // Get contacts for a specific facility
  getContactsByFacility(facilityName: string): Contact[] {
    // Try exact match first
    const exactMatch = this.contacts.get(facilityName);
    if (exactMatch) {
      return exactMatch;
    }

    // Try case-insensitive match
    const lowerFacility = facilityName.toLowerCase();
    for (const [key, contacts] of this.contacts.entries()) {
      if (key.toLowerCase() === lowerFacility) {
        return contacts;
      }
    }

    // Try partial match (facility name contains search term)
    const partialMatches: Contact[] = [];
    for (const [key, contacts] of this.contacts.entries()) {
      if (key.toLowerCase().includes(lowerFacility) || lowerFacility.includes(key.toLowerCase())) {
        partialMatches.push(...contacts);
      }
    }

    return partialMatches;
  }

  // Get all facilities
  getAllFacilities(): string[] {
    return Array.from(this.contacts.keys()).sort();
  }

  // Get total contact count
  getTotalContacts(): number {
    let total = 0;
    for (const contacts of this.contacts.values()) {
      total += contacts.length;
    }
    return total;
  }

  // Get statistics
  getStats(): {
    totalFacilities: number;
    totalContacts: number;
    facilitiesWithMultipleContacts: number;
    averageContactsPerFacility: number;
  } {
    const totalFacilities = this.contacts.size;
    const totalContacts = this.getTotalContacts();
    const facilitiesWithMultiple = Array.from(this.contacts.values())
      .filter(contacts => contacts.length > 1).length;

    return {
      totalFacilities,
      totalContacts,
      facilitiesWithMultipleContacts: facilitiesWithMultiple,
      averageContactsPerFacility: totalFacilities > 0 ? totalContacts / totalFacilities : 0
    };
  }

  // Check if file has been modified and reload if needed
  async checkAndReload(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.filePath);
      if (this.lastModified && stats.mtime > this.lastModified) {
        console.log('Excel file has been modified, reloading...');
        await this.initialize();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking file modification:', error);
      return false;
    }
  }

  // Find best facility match for a given name
  findBestMatch(searchName: string): { facility: string; confidence: number } | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    const searchLower = searchName.toLowerCase();

    for (const facility of this.contacts.keys()) {
      const facilityLower = facility.toLowerCase();
      
      // Exact match
      if (facilityLower === searchLower) {
        return { facility, confidence: 1.0 };
      }

      // Calculate similarity score
      let score = 0;
      
      // Contains full search term
      if (facilityLower.includes(searchLower) || searchLower.includes(facilityLower)) {
        score = 0.8;
      }
      
      // Split words and check overlap
      const searchWords = searchLower.split(/\s+/);
      const facilityWords = facilityLower.split(/\s+/);
      const commonWords = searchWords.filter(word => 
        facilityWords.some(fWord => fWord.includes(word) || word.includes(fWord))
      );
      
      if (commonWords.length > 0) {
        score = Math.max(score, commonWords.length / Math.max(searchWords.length, facilityWords.length));
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = facility;
      }
    }

    return bestMatch && bestScore > 0.5 
      ? { facility: bestMatch, confidence: bestScore }
      : null;
  }
}

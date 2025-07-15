// CPower dispatch email parser
import { DispatchEvent, DispatchFacility } from '../types';
import { simpleParser } from 'mailparser';
import * as fs from 'fs/promises';

export class CPowerEmailParser {
  
  // Parse an .eml file
  async parseEmailFile(filePath: string): Promise<DispatchEvent | null> {
    try {
      const emailContent = await fs.readFile(filePath, 'utf-8');
      return await this.parseEmailContent(emailContent);
    } catch (error) {
      console.error('Error reading email file:', error);
      return null;
    }
  }

  // Parse raw email content
  async parseEmailContent(rawEmail: string): Promise<DispatchEvent | null> {
    try {
      const parsed = await simpleParser(rawEmail);
      
      // Extract basic email info
      const messageId = parsed.messageId || '';
      const subject = parsed.subject || '';
      const from = parsed.from?.text || '';
      const htmlBody = parsed.html || parsed.textAsHtml || '';
      
      // Check if this is a dispatch email
      if (!this.isDispatchEmail(subject, from)) {
        return null;
      }

      // Parse dispatch details
      const dispatchEvent = this.extractDispatchDetails(htmlBody);
      
      if (!dispatchEvent) {
        return null;
      }

      return {
        messageId,
        subject,
        from,
        ...dispatchEvent,
        rawContent: rawEmail
      };
    } catch (error) {
      console.error('Error parsing email:', error);
      return null;
    }
  }

  // Check if email is a CPower dispatch
  private isDispatchEmail(subject: string, from: string): boolean {
    const subjectLower = subject.toLowerCase();
    const fromLower = from.toLowerCase();
    
    return (
      fromLower.includes('cpowerdispatch') &&
      (subjectLower.includes('dispatched event') || 
       subjectLower.includes('dispatch event') ||
       subjectLower.includes('curtailment'))
    );
  }

  // Extract dispatch details from HTML body
  private extractDispatchDetails(html: string): Omit<DispatchEvent, 'messageId' | 'subject' | 'from' | 'rawContent'> | null {
    try {
      // Decode HTML entities
      const decodedHtml = this.decodeHtmlEntities(html);
      
      // Extract dispatch type
      const dispatchType = this.extractDispatchType(decodedHtml);
      
      // Extract event times
      const eventTimes = this.extractEventTimes(decodedHtml);
      if (!eventTimes) {
        console.error('Could not extract event times');
        return null;
      }

      // Extract facilities
      const facilities = this.extractFacilities(decodedHtml);
      
      return {
        dispatchType,
        eventDate: eventTimes.eventDate,
        startTime: eventTimes.startTime,
        endTime: eventTimes.endTime,
        timezone: eventTimes.timezone,
        facilities
      };
    } catch (error) {
      console.error('Error extracting dispatch details:', error);
      return null;
    }
  }

  // Decode HTML entities like =3D to =
  private decodeHtmlEntities(html: string): string {
    // Handle quoted-printable encoding
    return html
      .replace(/=3D/g, '=')
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  // Extract dispatch type from email
  private extractDispatchType(html: string): string {
    // Look for patterns like "National Grid - Targeted Dispatch"
    const dispatchForMatch = html.match(/Dispatch Alert For:\s*<strong>([^<]+)<\/strong>/i);
    if (dispatchForMatch) {
      return dispatchForMatch[1].trim();
    }

    // Fallback: look in subject area
    const subjectMatch = html.match(/has informed CPower of a\s*<em><strong>([^<]+)<\/strong><\/em>/i);
    if (subjectMatch) {
      return subjectMatch[1].trim();
    }

    return 'Unknown Dispatch';
  }

  // Extract event times
  private extractEventTimes(html: string): { 
    eventDate: Date, 
    startTime: Date, 
    endTime: Date, 
    timezone: string 
  } | null {
    try {
      // Extract start time
      const startMatch = html.match(/Event will Start at:\s*<strong>([^<]+)<\/strong>/i);
      if (!startMatch) return null;

      // Extract end time
      const endMatch = html.match(/Event will End at:\s*<strong>([^<]+)<\/strong>/i);
      if (!endMatch) return null;

      // Parse the time strings
      const startTimeStr = startMatch[1].trim();
      const endTimeStr = endMatch[1].trim();

      // Extract date and times
      const startParsed = this.parseEventTime(startTimeStr);
      const endParsed = this.parseEventTime(endTimeStr);

      if (!startParsed || !endParsed) return null;

      return {
        eventDate: startParsed.date,
        startTime: startParsed.date,
        endTime: endParsed.date,
        timezone: startParsed.timezone
      };
    } catch (error) {
      console.error('Error parsing event times:', error);
      return null;
    }
  }

  // Parse time string like "05:00 PM (EDT) On 06/24/2025"
  private parseEventTime(timeStr: string): { date: Date, timezone: string } | null {
    try {
      // Match pattern: "05:00 PM (EDT) On 06/24/2025"
      const match = timeStr.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*\(([A-Z]{3,4})\)\s*On\s*(\d{2}\/\d{2}\/\d{4})/i);
      
      if (!match) {
        console.error('Could not parse time string:', timeStr);
        return null;
      }

      const [, time, timezone, date] = match;
      
      // Combine date and time
      const [month, day, year] = date.split('/');
      const dateTimeStr = `${month}/${day}/${year} ${time}`;
      
      // Create date object
      // JavaScript's Date constructor will interpret this as local time
      // No adjustment needed - the time is already in EDT/EST
      const eventDate = new Date(dateTimeStr);
      
      return { date: eventDate, timezone };
    } catch (error) {
      console.error('Error parsing time:', error);
      return null;
    }
  }

  // Extract facilities from HTML table
  private extractFacilities(html: string): DispatchFacility[] {
    const facilities: DispatchFacility[] = [];
    
    try {
      // Find the table containing facilities
      const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi);
      if (!tableMatch) return facilities;

      // Find the facilities table (has Company Name header)
      let facilitiesTable = '';
      for (const table of tableMatch) {
        if (table.includes('Company Name') && table.includes('Facility Name')) {
          facilitiesTable = table;
          break;
        }
      }

      if (!facilitiesTable) return facilities;

      // Extract all rows
      const rowMatches = facilitiesTable.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
      if (!rowMatches) return facilities;

      // Skip header row
      for (let i = 1; i < rowMatches.length; i++) {
        const row = rowMatches[i];
        const facility = this.parseTableRow(row);
        if (facility) {
          facilities.push(facility);
        }
      }
    } catch (error) {
      console.error('Error extracting facilities:', error);
    }

    return facilities;
  }

  // Parse a single table row
  private parseTableRow(rowHtml: string): DispatchFacility | null {
    try {
      // Extract all cells
      const cellMatches = rowHtml.match(/<td[^>]*>([^<]*)<\/td>/gi);
      if (!cellMatches || cellMatches.length < 5) return null;

      // Extract cell values
      const cells = cellMatches.map(cell => {
        const match = cell.match(/<td[^>]*>([^<]*)<\/td>/i);
        return match ? match[1].trim() : '';
      });

      return {
        companyName: cells[0],
        facilityName: cells[1],
        address: cells[2],
        accountNumber: cells[3],
        dispatchTarget: cells[4]
      };
    } catch (error) {
      console.error('Error parsing table row:', error);
      return null;
    }
  }

  // Get a summary of the dispatch
  getSummary(event: DispatchEvent): string {
    const facilityCount = event.facilities.length;
    const startTimeStr = event.startTime.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    });
    const endTimeStr = event.endTime.toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      timeStyle: 'short'
    });

    return `${event.dispatchType} event on ${startTimeStr} - ${endTimeStr} affecting ${facilityCount} facilities`;
  }
}

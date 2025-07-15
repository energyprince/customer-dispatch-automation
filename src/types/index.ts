// Type definitions for CPower dispatch system

export interface DispatchFacility {
  companyName: string;
  facilityName: string;
  address: string;
  accountNumber: string;
  dispatchTarget: string;
}

export interface DispatchEvent {
  messageId: string;
  subject: string;
  from: string;
  dispatchType: string;
  eventDate: Date;
  startTime: Date;
  endTime: Date;
  timezone: string;
  facilities: DispatchFacility[];
  rawContent: string;
}

export interface ParsedEmailContent {
  messageId: string;
  subject: string;
  from: string;
  htmlBody: string;
  textBody: string;
}

export interface Contact {
  facility: string;
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  cell?: string;
  dispatchable: boolean;
}

export interface ScheduledJob {
  facilityName: string;
  eventId: string;
  scheduledTime: Date;
  contacts: Contact[];
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  date: string;
  customerName: string;
  timeEntryIds: string[];
  manualItems: InvoiceItem[];
  markupMultiplier: number;
  total: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TimeEntry {
  id: string;
  projectName: string;
  clockIn: string; // ISO string
  clockInLocation?: Coordinates;
  clockOut?: string; // ISO string
  clockOutLocation?: Coordinates;
}

export interface UserProfile {
  id?: string;
  name: string;
  hourlyWage: number;
}

export interface CompanyInfo {
  businessName: string;
  tagline: string;
  contactLine: string;
  address: string;
}

export interface ChatMessage {
  messageId: string;
  senderId: string;
  senderName: string;
  messageText: string;
  timestamp: string; // ISO string
  status: 'pending' | 'sent' | 'failed';
}

export interface Task {
  id: string;
  projectId: string; // Dynamic reference to project name/job
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  createdAt: string;
}



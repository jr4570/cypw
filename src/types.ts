/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  SCANNER = 'scanner'
}

export interface UserProfile {
  id: string;
  email: string;
  name: string; // Encrypted in store, decrypted in API
  phone?: string; // Encrypted in store, decrypted in API
  role: UserRole;
  createdAt: string;
  deletionScheduledAt?: string; // 7-day cooling period account deletion
}

export interface EventSetting {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  price: number;
  capacity: number;
  soldCount: number;
  coverImage: string;
  category: string;
  status: 'pending' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  zones: { name: string; allocation: number; priceModifier: number }[];
  requireSeatSelection?: boolean;
}

export interface Ticket {
  id: string; // UUID
  ticketCode: string; // TIX-EVT_ID-USR_ID-SERIAL-SIG (Cryptographically signed)
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  userId: string;
  ownerEmail: string; // Current owner
  purchaserEmail: string; // Original buyer
  zone: string;
  seat: string;
  price: number;
  status: 'valid' | 'checked_in' | 'transferred' | 'refunded';
  purchasedAt: string;
  checkedInAt?: string;
  isGifted: boolean;
  history: string[]; // Log of actions on this ticket
}

export interface CheckInLog {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  ownerEmail: string;
  ownerName?: string;
  ownerPhone?: string;
  zone?: string;
  seat?: string;
  price?: number;
  checkedInAt: string;
  status: 'success' | 'duplicate' | 'invalid_sig' | 'not_found';
  device?: string;
  errorReason?: string;
}

export interface TransferHistory {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  senderEmail: string;
  receiverEmail: string;
  transferredAt: string;
  secureHash: string; // Verification code / hash of transfer
}

export interface AdminStats {
  totalRevenue: number;
  totalTicketsSold: number;
  totalEventsCount: number;
  totalCheckedIn: number;
  salesTimeline: { date: string; count: number; revenue: number }[];
  checkInRatesByEvent: { eventId: string; title: string; checkedIn: number; total: number }[];
  recentLogs: CheckInLog[];
}

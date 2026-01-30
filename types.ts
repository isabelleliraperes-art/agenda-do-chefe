
export type EventType = 'meeting' | 'lecture' | 'event' | 'task' | 'ceremony';
export type EventStatus = 'active' | 'cancelled' | 'rescheduled' | 'completed' | 'pending';
export type UserRole = 'chefe' | 'secretaria';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  type: EventType;
  status: EventStatus;
  responsible: string; // Quem solicitou ou organiza
  participants: string[]; // Autoridades ou equipes presentes
  createdBy: string; // Quem está preenchendo a agenda
  reminderMinutes?: number; // Antecedência para notificação em minutos
  emoji?: string;
  color?: string;
}

export type ViewType = 'month' | 'week' | 'dashboard';

export interface SmartAddResult {
  title: string;
  description: string;
  start: string;
  end: string;
  type: EventType;
  responsible: string;
  participants: string[];
  createdBy?: string;
  emoji?: string;
}

export type Platform = 'instagram' | 'x' | 'linkedin' | 'facebook' | 'tiktok';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export const PLATFORMS: { id: Platform; label: string; limit: number }[] = [
  { id: 'instagram', label: 'Instagram', limit: 2200 },
  { id: 'x', label: 'X (Twitter)', limit: 280 },
  { id: 'linkedin', label: 'LinkedIn', limit: 2200 },
  { id: 'facebook', label: 'Facebook', limit: 2200 },
  { id: 'tiktok', label: 'TikTok', limit: 2200 },
];
export const TONES = ['friendly', 'professional', 'witty', 'inspirational', 'bold', 'casual'];

export interface Post {
  id: string; userId: string; title: string; prompt: string; platform: Platform; tone: string;
  caption: string; hashtags: string[]; scheduledAt: string | null; status: PostStatus; taskNotes: string;
  notify: boolean; reminderSentAt: string | null;
  mediaPath: string | null; mediaName: string | null; mediaType: string | null; mediaSize: number | null;
  driveFileId: string | null; driveSyncedAt: string | null; createdAt: string; updatedAt: string;
}
export interface Profile { id: string; email: string; fullName: string; role: 'admin' | 'creator'; createdAt: string }
export interface NotificationSettings {
  userId: string; email: string; enabled: boolean; sendOnSchedule: boolean; sendReminder: boolean;
  leadMinutes: number; subjectTemplate: string; bodyTemplate: string; timezone: string;
}
export interface NotificationLog { id: string; postId: string | null; userId: string; kind: string; recipient: string; subject: string; status: 'sent' | 'failed' | 'skipped'; error: string | null; createdAt: string }
export interface CaptionOption { caption: string; hashtags: string[] }

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const snake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
export function toCamel<T>(row: any): T { const o: any = {}; for (const k in row) o[camel(k)] = row[k]; return o; }
export function toSnake(obj: any): any { const o: any = {}; for (const k in obj) if (obj[k] !== undefined) o[snake(k)] = obj[k]; return o; }

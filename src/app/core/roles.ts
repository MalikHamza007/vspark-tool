export type Role = 'admin' | 'creator';
export type Permission = 'captions.generate' | 'posts.manage' | 'settings.manage' | 'admin.view';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: ['captions.generate', 'posts.manage', 'settings.manage', 'admin.view'],
  creator: ['captions.generate', 'posts.manage', 'settings.manage'],
};
export const ROLE_INFO: Record<Role, string> = {
  admin: 'Oversees every creator, post and notification across the workspace.',
  creator: 'Generates captions with Gemini, schedules posts and syncs drafts to Google Drive.',
};
export function can(role: Role | null | undefined, p: Permission): boolean {
  return !!role && ROLE_PERMISSIONS[role]?.includes(p);
}

import type { UserRole } from '../types';

export const ADMIN_ROLES: UserRole[] = [
  'owner_admin',
  'finance_admin',
  'support_admin',
  'content_admin',
  'viewer',
];

export function isAdminRole(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return ADMIN_ROLES.includes(role);
}

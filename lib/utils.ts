import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ApiUser, AppUser } from '@/types/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function mapApiUser(u: ApiUser): AppUser {
  const hubName = u.hub?.name ?? null;
  return {
    id: u._id,
    name: u.full_name,
    email: u.email,
    phone: u.phone,
    is_active: u.is_active,
    hubId: u.hub?._id ?? null,
    hubName,
    location: hubName ?? 'All Hubs',
    dataScope: u.data_scope,
    role: u.role.label,
    roleName: u.role.name,
    permissions: u.permissions,
  };
}

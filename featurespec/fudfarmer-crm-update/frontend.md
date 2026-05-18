# FudFarmer CRM — Frontend Update Spec
**Project:** `fudfarmer-crm-next` (Next.js App Router + TanStack Query + Tailwind)  
**Scope:** Replace all localStorage/StorageService data with real API calls. Rewrite auth, permissions, login, and hooks. Add route-level middleware protection.

---

## Table of Contents
1. [Overview of Changes](#1-overview-of-changes)
2. [New API Types (`types/api.ts`)](#2-new-api-types-typesapits)
3. [AuthContext Rewrite](#3-authcontext-rewrite)
4. [Permissions Rewrite](#4-permissions-rewrite)
5. [Login Page Rewrite](#5-login-page-rewrite)
6. [Hooks Rewrite (`hooks/use-queries.ts`)](#6-hooks-rewrite-hooksuse-queriests)
7. [Next.js Middleware](#7-nextjs-middleware)
8. [Per-Page API Wiring](#8-per-page-api-wiring)
9. [Files to Delete / Clean Up](#9-files-to-delete--clean-up)
10. [Implementation Order](#10-implementation-order)

---

## 1. Overview of Changes

| File / Area | Change Type | Summary |
|-------------|-------------|---------|
| `contexts/auth-context.tsx` | Rewrite | Real `/auth/whoami` + `/auth/login` + `/auth/logout` |
| `contexts/AuthContext.tsx` | Delete | Orphan file using React Router — not wired in |
| `lib/permissions.ts` | Rewrite | Remove localStorage; add `PERMISSION_MAP`; check `user.permissions[]` |
| `hooks/use-permissions.ts` | Update | No change to interface; works automatically with new permissions source |
| `hooks/use-queries.ts` | Rewrite | All hooks call real API endpoints via `axiosGet`/`axiosPost`/etc. |
| `app/login/page.tsx` | Rewrite | Email + password fields; wired to real auth context |
| `middleware.ts` | New | Cookie-based route protection for `/(app)/**` |
| `types/api.ts` | New | TypeScript types matching backend API response shapes |
| `lib/storage-service.ts` | Deprecate | No longer used after hooks rewrite |

---

## 2. New API Types (`types/api.ts`)

Create `types/api.ts` alongside the existing `types.ts`. These types match backend response shapes exactly (snake_case from the API, converted where needed).

```typescript
// The shape returned by GET /auth/whoami
export interface ApiUser {
  _id: string;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  is_active: boolean;
  role: {
    label: string; // e.g. "Hub Manager"
    name: string;  // e.g. "hub_manager"
  };
  permissions: string[]; // e.g. ["view_inventory", "create_sku", ...]
}

// The shape used throughout the app (mapped from ApiUser)
export interface AppUser {
  id: string;           // mapped from _id
  name: string;         // mapped from full_name
  email: string;
  phone: string;
  location: string;
  is_active: boolean;
  role: string;         // the role label e.g. "Hub Manager"
  roleName: string;     // the role slug e.g. "hub_manager"
  permissions: string[];
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  message: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: T[];
}
```

**Mapping helper** (add to `lib/utils.ts`):
```typescript
import { ApiUser, AppUser } from '@/types/api';

export function mapApiUser(u: ApiUser): AppUser {
  return {
    id:          u._id,
    name:        u.full_name,
    email:       u.email,
    phone:       u.phone,
    location:    u.location,
    is_active:   u.is_active,
    role:        u.role.label,
    roleName:    u.role.name,
    permissions: u.permissions,
  };
}
```

The existing `Agent` type in `types.ts` can be kept for backwards compatibility during migration but pages should gradually adopt `AppUser`. The `AuthContextType` in `types.ts` must be updated to reflect the new auth interface (see §3).

---

## 3. AuthContext Rewrite

**File:** `contexts/auth-context.tsx`  
**Pattern:** Adapted from the old Vite app's `AuthContext.tsx` — same cookie + whoami approach but using Next.js `useRouter` instead of React Router's `useNavigate`.

### 3.1 Updated `AuthContextType` (update `types.ts`)

```typescript
import { AppUser } from './types/api';

export interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  error: boolean;
  refetch: () => void;
}
```

### 3.2 `useWhoAmI` query hook (add to `hooks/use-queries.ts`)

```typescript
export function useWhoAmI() {
  return useQuery({
    queryKey: ['whoami'],
    queryFn: async () => {
      const res = await axiosGet('auth/whoami', true); // withCredentials
      return mapApiUser(res.data as ApiUser);
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
```

### 3.3 Full `AuthProvider` implementation

```typescript
'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContextType, AppUser } from '@/types/api';
import { useWhoAmI } from '@/hooks/use-queries';
import { axiosPost } from '@/lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const {
    data: user,
    isError,
    isRefetching,
    refetch,
  } = useWhoAmI();

  useEffect(() => {
    if (user || isError) setLoading(false);
  }, [user, isError]);

  const login = async (email: string, password: string) => {
    await axiosPost('auth/login', { email, password }, true);
    await refetch();
    router.replace('/');
  };

  const logout = async () => {
    await axiosPost('auth/logout', {}, true);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{
      user: user ?? null,
      login,
      logout,
      isAuthenticated: !!user,
      loading,
      error: isError,
      refetch,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
```

### 3.4 `(app)/layout.tsx` — Auth guard

No structural change needed — the existing redirect logic (`if (!isAuthenticated) → /login`) continues to work. Update the `user` reference from `Agent` to `AppUser` for the sidebar's `user.name` and `user.role`.

---

## 4. Permissions Rewrite

### 4.1 `lib/permissions.ts`

**Remove:**
- `getRolePermissions()` — localStorage read
- `saveRolePermissions()` — localStorage write
- `DEFAULT_ROLE_PERMISSIONS` — no longer needed client-side

**Keep:**
- `ALL_PERMISSIONS` const array
- `Permission` type
- `PERMISSION_GROUPS` (used by Settings → Roles tab UI)

**Add:**

```typescript
import { AppUser } from '@/types/api';

/**
 * Maps frontend Permission keys to backend submodule names.
 * Frontend uses dot-notation; backend uses underscore names from MODULE_SUBMODULES.
 */
export const PERMISSION_MAP: Record<Permission, string> = {
  'dashboard.view':           'view_dashboard',
  'analytics.view':           'view_analytics',
  'inventory.view':           'view_inventory',
  'inventory.create':         'create_sku',
  'inventory.edit':           'edit_product_detail',
  'inventory.adjust_stock':   'adjust_stock',
  'inventory.transfer':       'transfer_btw_hubs',
  'inventory.import':         'import_csv',
  'inventory.export':         'export_csv',
  'customers.view':           'view_customers',
  'customers.create':         'add_customer',
  'customers.edit':           'edit_customer',
  'sales.view':               'view_sales',
  'sales.create':             'create_sales',
  'sales.edit':               'edit_sales',
  'sales.void':               'void_sales',
  'sales.update_status':      'update_payment_status',
  'sales.update_delivery':    'update_delivery_status',
  'sales.import':             'import_sales_csv',
  'credits.view':             'view_credit',
  'credits.record_payment':   'record_payment',
  'credits.set_due_date':     'set_due_date',
  'interactions.view':        'view_interactions',
  'interactions.create':      'log_interaction',
  'interactions.resolve':     'resolve_interaction',
  'audit.view':               'view_audit_trail',
  'settings.manage_users':    'manage_users',
  'settings.manage_hubs':     'manage_hubs',
  'settings.manage_roles':    'manage_roles',
  'settings.reset_data':      'manage_users', // no dedicated submodule; gated same as users
};

/**
 * Check if user has a frontend permission key.
 * Looks up the backend submodule name from PERMISSION_MAP,
 * then checks against user.permissions[] returned by whoami.
 */
export function hasPermission(user: AppUser | null, permission: Permission): boolean {
  if (!user) return false;
  const backendKey = PERMISSION_MAP[permission];
  if (!backendKey) return false;
  return user.permissions.includes(backendKey);
}

export function hasAnyPermission(user: AppUser | null, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(user, p));
}
```

### 4.2 `hooks/use-permissions.ts`

No change required — `hasPermission` still takes `(user, permission)`. Since `user` now comes from `useAuth()` with the correct `AppUser` shape, the hook just works:

```typescript
'use client';

import { useAuth } from '../contexts/auth-context';
import { hasPermission, hasAnyPermission, Permission } from '../lib/permissions';

export function usePermissions() {
  const { user } = useAuth();
  return {
    can:     (permission: Permission) => hasPermission(user, permission),
    canAny:  (permissions: Permission[]) => hasAnyPermission(user, permissions),
    isAdmin: user?.roleName === 'company_admin',
    user,
  };
}
```

### 4.3 Sidebar — no changes needed

`sidebar.tsx` already calls `can(item.permission)` which flows through `usePermissions → hasPermission`. Once auth is real, sidebar tabs will auto-hide/show based on actual role permissions.

---

## 5. Login Page Rewrite

**File:** `app/login/page.tsx`

**Remove:**
- `useAgents()` hook import
- Agent `<select>` dropdown
- `selectedAgentId` state

**Add:**
- `email: string` state
- `password: string` state (kept)
- Call `login(email, password)` from auth context

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Leaf, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/');
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      // router.replace('/') is called inside login() on success
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border bg-card p-8 shadow-xl shadow-primary/5">
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
              <Leaf className="text-primary-foreground" size={22} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">FudFarmer CRM</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground/80">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@fudfarmer.com"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-foreground/80">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary placeholder:text-muted-foreground/50"
              />
            </div>

            {error && (
              <p className="text-[13px] text-destructive font-medium bg-destructive/8 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary text-primary-foreground h-10 px-4 text-sm font-medium shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

---

## 6. Hooks Rewrite (`hooks/use-queries.ts`)

All hooks replace `StorageService.*` with API calls. Use `withCredentials: true` on all authenticated requests.

**Base pattern:**
```typescript
// Query
export function useHubs() {
  return useQuery({
    queryKey: ['hubs'],
    queryFn: () => axiosGet('hub', true).then((r) => r.data as Hub[]),
  });
}

// Mutation
export function useCreateHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: Partial<Hub>) => axiosPost('hub', dto, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubs'] }),
  });
}
```

### 6.1 Auth

```typescript
// GET /auth/whoami
export function useWhoAmI() { ... } // see §3.2
```

### 6.2 Hubs

```typescript
export function useHubs()          // GET /hub
export function useCreateHub()     // POST /hub
export function useUpdateHub()     // PATCH /hub/:id
export function useDeleteHub()     // DELETE /hub/:id
```

### 6.3 Customers

```typescript
export function useCustomers()       // GET /customers  (query: hub_id?, segment?, search?, type?)
export function useCreateCustomer()  // POST /customers
export function useUpdateCustomer()  // PATCH /customers/:id
export function useSegments()        // GET /customers/segments
export function useCreateSegment()   // POST /customers/segments
export function useDeleteSegment()   // DELETE /customers/segments/:id
```

### 6.4 Sales

```typescript
export function useSales()                // GET /sales  (query: status?, date_from?, date_to?, is_credit?)
export function useCreateSale()           // POST /sales
export function useUpdateSale()           // PATCH /sales/:id
export function useUpdateSaleStatus()     // PATCH /sales/:id/status
export function useUpdateDeliveryStatus() // PATCH /sales/:id/delivery
export function useVoidSale()             // PATCH /sales/:id/void
```

### 6.5 Inventory

```typescript
export function useInventory()          // GET /inventory  (query: hub_id?, category?, low_stock?, search?)
export function useCreateProduct()      // POST /inventory
export function useUpdateProduct()      // PATCH /inventory/:id
export function useStockLogs()          // GET /inventory/stock-logs  (query: item_id?, hub_id?, type?, dates?)
export function useRecordStockMove()    // POST /inventory/stock-logs
export function useTransferStock()      // POST /inventory/transfer
export function useBatchStockUpdate()   // POST /inventory/batch
```

### 6.6 Credits

```typescript
export function useCredits()         // GET /credits  (query: status?, customer_id?, flagged?)
export function useCreditRecord(id)  // GET /credits/:id
export function useRecordPayment()   // POST /credits/:id/payment
export function useSetDueDate()      // PATCH /credits/:id/due-date
export function useFlagCredit()      // PATCH /credits/:id/flag
```

### 6.7 Interactions — Feedback

```typescript
export function useFeedback()        // GET /feedbacks
export function useCreateFeedback()  // POST /feedbacks
export function useResolveFeedback() // PATCH /feedbacks/:id/resolve
```

### 6.8 Interactions — Enquiries

```typescript
export function useEnquiries()        // GET /enquiries
export function useCreateEnquiry()    // POST /enquiries
export function useResolveEnquiry()   // PATCH /enquiries/:id/resolve
```

### 6.9 Interactions — Compensations

```typescript
export function useCompensations()              // GET /compensations
export function useCreateCompensation()         // POST /compensations
export function useUpdateCompensationStatus()   // PATCH /compensations/:id/status
```

### 6.10 Audit Trail

```typescript
export function useAuditLogs(filters?)  // GET /audit-trail  (query: entity_type?, user_id?, date_from?, date_to?, search?, page?, limit?)
```

### 6.11 Users (Agents)

```typescript
export function useAgents(query?)    // GET /users  (query: search?, role_id?, status?)
export function useCreateAgent()     // POST /users/create
export function useUpdateAgent()     // PATCH /users/:id
export function useDeleteAgent()     // DELETE /users/:id
```

### 6.12 Roles

```typescript
export function useRoles()        // GET /roles
export function useCreateRole()   // POST /roles
export function useUpdateRole()   // PATCH /roles/:id
export function useDeleteRole()   // DELETE /roles/:id
```

### 6.13 Tasks

```typescript
export function useTasks(filters?)  // GET /tasks  (query: assigned_to?, status?)
export function useCreateTask()     // POST /tasks
export function useUpdateTask()     // PATCH /tasks/:id
export function useDeleteTask()     // DELETE /tasks/:id
```

### 6.14 Dashboard

```typescript
export function useDashboardMetrics()  // GET /dashboard/metrics
```

---

## 7. Next.js Middleware

**File:** `middleware.ts` (project root, alongside `next.config.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('crm_session');

  // Already authenticated → redirect away from login
  if (sessionCookie && PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Not authenticated → redirect to login
  if (!sessionCookie && !PUBLIC_PATHS.includes(pathname)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except _next static files and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Note:** The middleware checks for the `crm_session` cookie (set by the backend as a `httpOnly`, `signed` cookie). Since signed cookies are verified server-side by the backend, the middleware only checks for the cookie's presence. Full token verification happens at the backend on every authenticated API call.

Once middleware is in place, the client-side redirect in `app/(app)/layout.tsx` becomes a fallback for race conditions rather than primary protection.

---

## 8. Per-Page API Wiring

### Dashboard (`app/(app)/page.tsx`)
- Replace all `useCustomers`, `useSales`, etc. with data from `useDashboardMetrics()`
- Keep existing KPI cards and Recharts; bind to real metric fields
- Remove `StorageService.getAuditLogs()` call

### Analytics (`app/(app)/analytics/page.tsx`)
- `useSales()` — sales trend data
- `useInventory()` — product performance
- `useCustomers()` — customer insights (total, repeat, B2B/B2C)
- `useCredits()` — credit & risk tab

### Inventory (`app/(app)/inventory/page.tsx`)
- `useInventory()`, `useStockLogs()`, `useHubs()`
- Mutations: `useCreateProduct()`, `useUpdateProduct()`, `useRecordStockMove()`, `useTransferStock()`, `useBatchStockUpdate()`
- Remove all `StorageService.*` and `StorageService.addAuditLog()` calls (audit is written server-side)

### Customers (`app/(app)/customers/page.tsx`)
- `useCustomers()`, `useSegments()`, `useHubs()`, `useAgents()`
- Customer detail panel: data for credits/sales/interactions comes from existing records joined client-side by `customer_id` (keep as-is; data comes from same queries)
- Mutations: `useCreateCustomer()`, `useUpdateCustomer()`, `useCreateSegment()`

### Sales (`app/(app)/sales/page.tsx`)
- `useSales()`, `useCustomers()`, `useInventory()`, `useHubs()`
- Mutations: `useCreateSale()`, `useUpdateSale()`, `useUpdateSaleStatus()`, `useUpdateDeliveryStatus()`, `useVoidSale()`

### Credits (`app/(app)/credits/page.tsx`)
- `useCredits()`, `useCustomers()`
- Mutations: `useRecordPayment()`, `useSetDueDate()`, `useFlagCredit()`

### Interactions (`app/(app)/interactions/page.tsx`)
- `useFeedback()`, `useEnquiries()`, `useCompensations()`, `useCustomers()`
- Mutations: `useCreateFeedback()`, `useResolveFeedback()`, `useCreateEnquiry()`, `useResolveEnquiry()`, `useCreateCompensation()`, `useUpdateCompensationStatus()`

### Audit (`app/(app)/audit/page.tsx`)
- `useAuditLogs(filters)` — pass filter state as query params
- Remove `StorageService.getAuditLogs()`

### Settings (`app/(app)/settings/page.tsx`)
- **Profile tab:** `useAuth().user` for display; `axiosPost('auth/reset-password', ...)` for password change
- **Users tab:** `useAgents()`, `useRoles()`; mutations: `useCreateAgent()`, `useUpdateAgent()`, `useDeleteAgent()`
- **Hubs tab:** `useHubs()`; mutations: `useCreateHub()`, `useUpdateHub()`, `useDeleteHub()`
- **Roles & Permissions tab:** `useRoles()`; mutations: `useCreateRole()`, `useUpdateRole()`, `useDeleteRole()`
  - Role permission editor: bind checkboxes to `PERMISSION_GROUPS` (from `lib/permissions.ts`); map using `PERMISSION_MAP` when building the DTO for the API
- **Data tab:** Remove `StorageService` reset functionality entirely (or hide behind admin flag)

---

## 9. Files to Delete / Clean Up

| File | Action | Reason |
|------|--------|--------|
| `contexts/AuthContext.tsx` | Delete | Orphan; uses `react-router-dom` + non-existent hooks; conflicts with active auth stack |
| `lib/storage-service.ts` | Delete after migration | No longer needed once all hooks use real API |
| `lib/permissions.ts` — `getRolePermissions`, `saveRolePermissions`, `DEFAULT_ROLE_PERMISSIONS` | Remove these exports | Replaced by `PERMISSION_MAP` + `user.permissions` |

---

## 10. Implementation Order

```
Phase 1 — Types & API Foundation
  1a. Create types/api.ts (ApiUser, AppUser, ApiResponse, PaginatedResponse)
  1b. Add mapApiUser() to lib/utils.ts
  1c. Update AuthContextType in types.ts

Phase 2 — Auth Layer
  2a. Rewrite contexts/auth-context.tsx (useWhoAmI, login, logout)
  2b. Add useWhoAmI hook to hooks/use-queries.ts
  2c. Rewrite app/login/page.tsx (email + password)
  2d. Add middleware.ts
  2e. Delete contexts/AuthContext.tsx

Phase 3 — Permissions
  3a. Rewrite lib/permissions.ts (add PERMISSION_MAP, remove localStorage)
  3b. Verify hooks/use-permissions.ts works with new AppUser type (no code change expected)

Phase 4 — Hooks (work in dependency order)
  4a. useHubs, useAgents, useRoles  (referenced by most pages)
  4b. useCustomers, useSegments
  4c. useInventory, useStockLogs
  4d. useSales
  4e. useCredits
  4f. useFeedback, useEnquiries, useCompensations
  4g. useAuditLogs, useTasks, useDashboardMetrics

Phase 5 — Page Wiring (per page, replacing StorageService calls)
  5a. Dashboard
  5b. Inventory
  5c. Customers
  5d. Sales
  5e. Credits
  5f. Interactions
  5g. Audit
  5h. Settings
  5i. Analytics

Phase 6 — Cleanup
  6a. Delete lib/storage-service.ts
  6b. Remove unused DEFAULT_ROLE_PERMISSIONS exports from lib/permissions.ts
  6c. Update types.ts Agent → AppUser references where needed
```

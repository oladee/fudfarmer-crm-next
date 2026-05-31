# FudFarmer CRM — Frontend Update Spec
**Project:** `fudfarmer-crm-next` (Next.js App Router + TanStack Query + Tailwind)  
**Scope:** Replace all localStorage/StorageService data with real API calls. Rewrite auth, permissions, login, and hooks. Add route-level middleware protection.

---

## Table of Contents
1. [Overview of Changes](#1-overview-of-changes)
2. [New API Types (`types/api.ts`)](#2-new-api-types-typesapits)
3. [AuthContext Rewrite](#3-authcontext-rewrite)
4. [Permissions Rewrite](#4-permissions-rewrite)
5. [Data Visibility & Hub Scoping (UI)](#5-data-visibility--hub-scoping-ui)
6. [Login Page Rewrite](#6-login-page-rewrite)
7. [Hooks Rewrite (`hooks/use-queries.ts`)](#7-hooks-rewrite-hooksuse-queriests)
8. [Next.js Middleware](#8-nextjs-middleware)
9. [Per-Page API Wiring](#9-per-page-api-wiring)
10. [Files to Delete / Clean Up](#10-files-to-delete--clean-up)
11. [Implementation Order](#11-implementation-order)

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
| Data visibility UI | New | Hub badge, scope-aware filters; trust backend scoping |

### Credit UX Model (key design decision)

| Layer | What the user sees |
|-------|-------------------|
| Credits main page | KPI metrics + **customer-grouped table** with aggregated outstanding balance |
| Customer drill-down | List of **per-sale credit items** with linked sale info |
| Credit item detail | Repayment history + **extension trail** per item |
| Sale creation | `due_date` required when `payment_mode` is not Full Payment; no `is_credit` toggle |
| Credit creation | Automatic from sales only — never manual from credits page |

### Data visibility (key design decision)

| Role (`data_scope`) | What the user sees in the app |
|---------------------|------------------------------|
| `company_admin` (`all`) | All hubs; hub switcher shows "All Hubs" + individual hubs |
| `hub_manager`, `finance` (`hub`) | Single hub only; no hub switcher; all agents' data in that hub |
| Agent roles (`assigned`) | Single hub; only customers assigned to them (+ records they created) |

**Settings (Users / Hubs / Roles tabs) is not data-scoped** — users with `settings.manage_*` permissions manage global config. Hub managers with `manage_users` may only create users assigned to their own hub.

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
  is_active: boolean;
  hub: { _id: string; name: string } | null; // null for company_admin
  data_scope: 'all' | 'hub' | 'assigned';
  role: {
    label: string;
    name: string;
  };
  permissions: string[];
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  hubId: string | null;
  hubName: string | null;
  dataScope: 'all' | 'hub' | 'assigned';
  role: string;
  roleName: string;
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

/** Customer-grouped row for credits main page — GET /credits/summary */
export interface CreditCustomerSummary {
  customer_id: string;
  customer_name: string;
  total_outstanding: number;
  open_credit_count: number;
  overdue_count: number;
  oldest_due_date: string | null;
}

/** Per-sale credit item — GET /credits?customer_id=... */
export interface CreditRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  sale: {
    id: string;
    date: string;
    amount: number;
    payment_mode: string;
    product_details?: string;
  };
  original_amount: number;
  amount_owed: number;
  date_issued: string;
  due_date: string;
  last_payment_date?: string;
  status: 'Pending' | 'Overdue' | 'Clear' | 'Voided';
  payment_terms?: string;
  extension_count: number;
  flagged?: boolean;
  flag_reason?: string;
  payments: CreditPayment[];
  due_date_extensions: DueDateExtension[];
}

export interface CreditPayment {
  id: string;
  date: string;
  amount: number;
  method?: string;
  recorded_by_name?: string;
  note?: string;
  reference_id?: string;
  balance_after: number;
}

export interface DueDateExtension {
  previous_due_date: string;
  new_due_date: string;
  extended_at: string;
  extended_by_name: string;
  reason?: string;
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
    is_active:   u.is_active,
    hubId:       u.hub?._id ?? null,
    hubName:     u.hub?.name ?? null,
    dataScope:   u.data_scope,
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

### 4.3 Sidebar — permission tabs only

`sidebar.tsx` already calls `can(item.permission)` for tab visibility. Update the user footer block:

```tsx
<p className="text-[10px] text-muted-foreground">
  {user.role} &middot; {user.hubName ?? 'All Hubs'}
</p>
```

Replace `user.location` with `user.hubName`. Tabs remain permission-driven; **data scope is enforced by the API**, not by hiding tabs.

---

## 5. Data Visibility & Hub Scoping (UI)

**Principle:** The frontend reflects scope for UX (labels, filters, form defaults) but **never relies on client-side filtering alone**. All list endpoints return pre-scoped data from the backend.

### 5.1 `useDataScope` hook — `hooks/use-data-scope.ts`

```typescript
'use client';

import { useAuth } from '@/contexts/auth-context';

export function useDataScope() {
  const { user } = useAuth();
  return {
    dataScope: user?.dataScope ?? 'assigned',
    hubId: user?.hubId ?? null,
    hubName: user?.hubName ?? null,
    isGlobal: user?.dataScope === 'all',       // company_admin
    isHubScoped: user?.dataScope === 'hub',    // hub_manager, finance
    isAssignedScoped: user?.dataScope === 'assigned',
    canSwitchHubs: user?.dataScope === 'all',
  };
}
```

### 5.2 Hub switcher behaviour (Inventory, Customers location filter, Sales, Dashboard)

| `dataScope` | Hub switcher | Default filter |
|-------------|--------------|----------------|
| `all` | Show "All Hubs" + each active hub | User selection persisted in local state |
| `hub` | Hidden — show read-only hub badge | Fixed to `user.hubId` |
| `assigned` | Hidden — show read-only hub badge | Fixed to `user.hubId` |

**Do not send `hub_id` query param** for non-global users — backend forces scope. For `company_admin`, optional `hub_id` param filters the view.

### 5.3 Forms — create / assign defaults

| Form | `company_admin` | `hub_manager` | Agent (`assigned`) |
|------|-----------------|---------------|---------------------|
| **Create customer** | Pick hub + assign any agent in that hub | Hub locked to own; assign any agent in hub | Hub locked; `assigned_agent` defaults to self |
| **Create sale** | Pick customer (any hub) | Customers in hub only | Assigned customers only |
| **Create user (Settings)** | Pick any hub + role | Hub locked to own; cannot create `company_admin` | N/A unless has `manage_users` |
| **Create SKU** | Pick hub | Hub locked to own | Hub locked to own |

Agent dropdowns in customer/sale forms:
- `hub_manager`: list agents where `user.hub_id = current hub`
- `assigned`: hide agent picker on create customer (self assigned); on edit, hub_manager only can reassign

### 5.4 Pages — scope notes

| Page | UI adjustment |
|------|---------------|
| **Dashboard** | Metrics auto-scoped by API; no client-side aggregation across hubs for non-admin |
| **Inventory** | Hide hub tabs for non-admin; show `{hubName}` badge in header |
| **Customers** | Location filter becomes read-only hub badge for non-admin; list is assignment-scoped for agents |
| **Sales** | Customer picker filtered by API; agents only see their sales + assigned customers' sales |
| **Credits** | Summary + drill-down scoped by API; agents see only assigned customers' credits |
| **Interactions** | Same customer-linked scoping |
| **Audit** | Hub-scoped; agents may see only their own actions |
| **Settings** | **Not scoped** for roles/hubs CRUD; Users tab lists scoped by API (hub_manager sees own hub's users only) |

### 5.5 Empty states

When an agent has no assigned customers, show guided empty state: *"No customers assigned to you yet. Contact your hub manager."* — not a permission error.

---

## 6. Login Page Rewrite

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

## 7. Hooks Rewrite (`hooks/use-queries.ts`)

All hooks replace `StorageService.*` with API calls. Use `withCredentials: true` on all authenticated requests.

**Data scope:** Do not append `hub_id` to query strings for non–`company_admin` users — the backend applies scope from the JWT session user. Only pass `hub_id` when `user.dataScope === 'all'` and the user has selected a hub filter in the UI.

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

### 7.1 Auth

```typescript
// GET /auth/whoami
export function useWhoAmI() { ... } // see §3.2
```

### 7.2 Hubs

```typescript
export function useHubs()          // GET /hub
export function useCreateHub()     // POST /hub
export function useUpdateHub()     // PATCH /hub/:id
export function useDeleteHub()     // DELETE /hub/:id
```

### 7.3 Customers

```typescript
export function useCustomers()       // GET /customers  (query: hub_id?, segment?, search?, type?)
export function useCreateCustomer()  // POST /customers
export function useUpdateCustomer()  // PATCH /customers/:id
export function useSegments()        // GET /customers/segments
export function useCreateSegment()   // POST /customers/segments
export function useDeleteSegment()   // DELETE /customers/segments/:id
```

### 7.4 Sales

```typescript
export function useSales()                // GET /sales  (query: status?, date_from?, date_to?, payment_mode?)
export function useCreateSale()           // POST /sales — see sale form rules below
export function useUpdateSale()           // PATCH /sales/:id
export function useUpdateSaleStatus()     // PATCH /sales/:id/status
export function useUpdateDeliveryStatus() // PATCH /sales/:id/delivery
export function useVoidSale()             // PATCH /sales/:id/void
```

**Sale creation form rules (FE + BE aligned):**

| Field | When required |
|-------|---------------|
| `payment_mode` | Always |
| `amount_paid` | When `payment_mode === 'Partial Credit'` |
| `due_date` | When `payment_mode === 'Full Credit'` or `'Partial Credit'` |

- Remove any `is_credit` checkbox/toggle from the sales form — credit is inferred from `payment_mode`
- When user selects `Full Credit` or `Partial Credit`, show a **Due Date** date-picker (required before submit)
- On successful `POST /sales`, if response includes `credit_record`, show toast: *"Sale recorded — credit of ₦X created, due {date}"*
- Do **not** create credits manually from the credits page

**Create sale payload shape:**
```typescript
interface CreateSaleDto {
  customer_id: string;
  amount: number;
  amount_paid?: number;       // required for Partial Credit
  payment_mode: 'Full Payment' | 'Full Credit' | 'Partial Credit';
  payment_type?: 'Cash' | 'Transfer' | 'POS';
  due_date?: string;          // required when payment_mode !== 'Full Payment' (ISO date)
  payment_terms?: string;
  channel?: string;
  delivery_status?: string;
  delivery_address?: string;
  notes?: string;
  items?: { product_id: string; quantity: number; unit_price: number }[];
}
```

---

### 7.5 Inventory

```typescript
export function useInventory()          // GET /inventory  (query: hub_id?, category?, low_stock?, search?)
export function useCreateProduct()      // POST /inventory
export function useUpdateProduct()      // PATCH /inventory/:id
export function useStockLogs()          // GET /inventory/stock-logs  (query: item_id?, hub_id?, type?, dates?)
export function useRecordStockMove()    // POST /inventory/stock-logs
export function useTransferStock()      // POST /inventory/transfer
export function useBatchStockUpdate()   // POST /inventory/batch
```

### 7.6 Credits

```typescript
export function useCreditSummary(filters?)                  // GET /credits/summary — customer-grouped list for main page
export function useCustomerCredits(customerId, filters?)    // GET /credits?customer_id=... — per-sale items
export function useCreditRecord(id)                       // GET /credits/:id — full detail with payments + extensions
export function useRecordPayment()                          // POST /credits/:id/payment
export function useExtendDueDate()                          // PATCH /credits/:id/extend-due-date
export function useFlagCredit()                             // PATCH /credits/:id/flag
```

**Credits page UX model** — two-level navigation:

```
/credits (main)
├── KPI metrics row (total outstanding, overdue count, customers with credit, avg days overdue)
└── Customer table (from useCreditSummary)
    ├── customer_name
    ├── total_outstanding (aggregated)
    ├── open_credit_count
    ├── overdue_count
    └── oldest_due_date
         │
         └── click row → Customer credit drawer/panel
              ├── Customer header + aggregated balance
              └── Per-sale credit items (from useCustomerCredits)
                   ├── linked sale (date, amount, payment_mode, product summary)
                   ├── original_amount / amount_owed / due_date / status
                   ├── extension_count badge
                   ├── Repayment history (payments[] for this item)
                   ├── Extension trail (due_date_extensions[] for this item)
                   └── Actions (per credit item):
                        • Record payment  → can('credits.record_payment')
                        • Extend due date   → can('credits.set_due_date') — modal with new date + reason
                        • Flag / unflag
```

**Extend due date modal:**
- Fields: `new_due_date` (must be after current `due_date`), `reason` (optional but encouraged)
- On success: invalidate `useCustomerCredits`, `useCreditRecord`, `useCreditSummary`
- Display `extension_count` on each credit row; show full trail in expanded/detail view

**Remove from credits main page:**
- Flat single-row-per-customer credit model
- Any client-side credit creation

**Update `types.ts` (domain):**
- Remove `isCredit?: boolean` from `Sale` — derive credit badge from `payment_mode !== 'Full Payment'`
- Replace customer-level `CreditRecord` with per-sale model matching `types/api.ts`
- Remove `saleIds?: string[]` — each credit links to one `sale.id`

### 7.7 Interactions — Feedback

```typescript
export function useFeedback()        // GET /feedbacks
export function useCreateFeedback()  // POST /feedbacks
export function useResolveFeedback() // PATCH /feedbacks/:id/resolve
```

### 7.8 Interactions — Enquiries

```typescript
export function useEnquiries()        // GET /enquiries
export function useCreateEnquiry()    // POST /enquiries
export function useResolveEnquiry()   // PATCH /enquiries/:id/resolve
```

### 7.9 Interactions — Compensations

```typescript
export function useCompensations()              // GET /compensations
export function useCreateCompensation()         // POST /compensations
export function useUpdateCompensationStatus()   // PATCH /compensations/:id/status
```

### 7.10 Audit Trail

```typescript
export function useAuditLogs(filters?)  // GET /audit-trail  (query: entity_type?, user_id?, date_from?, date_to?, search?, page?, limit?)
```

### 7.11 Users (Agents)

```typescript
export function useAgents(query?)    // GET /users  (query: search?, role_id?, status?)
export function useCreateAgent()     // POST /users/create
export function useUpdateAgent()     // PATCH /users/:id
export function useDeleteAgent()     // DELETE /users/:id
```

### 7.12 Roles

```typescript
export function useRoles()        // GET /roles
export function useCreateRole()   // POST /roles
export function useUpdateRole()   // PATCH /roles/:id
export function useDeleteRole()   // DELETE /roles/:id
```

### 7.13 Tasks

```typescript
export function useTasks(filters?)  // GET /tasks  (query: assigned_to?, status?)
export function useCreateTask()     // POST /tasks
export function useUpdateTask()     // PATCH /tasks/:id
export function useDeleteTask()     // DELETE /tasks/:id
```

### 7.14 Dashboard

```typescript
export function useDashboardMetrics()  // GET /dashboard/metrics
```

---

## 8. Next.js Middleware

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

## 9. Per-Page API Wiring

### Dashboard (`app/(app)/page.tsx`)
- Replace all `useCustomers`, `useSales`, etc. with data from `useDashboardMetrics()`
- Keep existing KPI cards and Recharts; bind to real metric fields
- Remove `StorageService.getAuditLogs()` call

### Analytics (`app/(app)/analytics/page.tsx`)
- `useSales()` — sales trend data
- `useInventory()` — product performance
- `useCustomers()` — customer insights (total, repeat, B2B/B2C)
- `useCredits()` — credit & risk tab: use `useCreditSummary()` for aggregates; drill into `useCustomerCredits(customerId)` for per-sale overdue analysis

### Inventory (`app/(app)/inventory/page.tsx`)
- `useInventory()`, `useStockLogs()`, `useHubs()` (hub list only for `company_admin`)
- `useDataScope()` — hide hub switcher unless `canSwitchHubs`; show read-only `{hubName}` badge otherwise
- Mutations: `useCreateProduct()`, `useUpdateProduct()`, `useRecordStockMove()`, `useTransferStock()`, `useBatchStockUpdate()`
- New SKU form: pre-fill hub from `user.hubId` for non-admin; lock field as read-only
- Remove all `StorageService.*` and `StorageService.addAuditLog()` calls (audit is written server-side)

### Customers (`app/(app)/customers/page.tsx`)
- `useCustomers()`, `useSegments()`, `useHubs()`, `useAgents()` — lists auto-scoped by API
- `useDataScope()` — location/hub filter read-only for non-admin; agent sees only assigned customers
- Add customer form: hub locked for non-admin; agent dropdown scoped to hub (hub_manager) or hidden (agent, defaults to self)
- Customer detail panel: credits via `useCustomerCredits(selectedCustomer.id)`
- Mutations: `useCreateCustomer()`, `useUpdateCustomer()`, `useCreateSegment()`

### Sales (`app/(app)/sales/page.tsx`)
- `useSales()`, `useCustomers()`, `useInventory()`, `useHubs()`
- Customer picker populated from scoped `useCustomers()` — agents only see assigned customers
- Mutations: `useCreateSale()`, `useUpdateSale()`, `useUpdateSaleStatus()`, `useUpdateDeliveryStatus()`, `useVoidSale()`
- **Record sale form:** required `due_date` when not Full Payment; hide `is_credit`
- Sale detail: link to credit record when `payment_mode !== 'Full Payment'`

### Credits (`app/(app)/credits/page.tsx`)

**Main view (default):**
- `useCreditSummary()` — drives KPI cards + customer-grouped table
- KPIs: total outstanding across all customers, overdue credit items count, customers with open credit, total flagged
- Table columns: Customer, Total Outstanding, Open Credits, Overdue, Oldest Due Date
- Click customer row → open customer credit panel (drawer or slide-over)

**Customer credit panel:**
- `useCustomerCredits(customerId)` — list of per-sale credit items
- Each item shows: sale date/ref, sale amount, credit original/owed, due date, status, extension count
- Expand item or open sub-panel for:
  - **Repayment history** — `payments[]` timeline
  - **Extension trail** — `due_date_extensions[]` with who/when/reason
- Actions per item: Record Payment, Extend Due Date (with reason), Flag

**Mutations:** `useRecordPayment()`, `useExtendDueDate()`, `useFlagCredit()`

**Customers page credit tab:** update to fetch `useCustomerCredits(selectedCustomer.id)` instead of a single customer credit record; show list of credit items linked to sales

### Interactions (`app/(app)/interactions/page.tsx`)
- `useFeedback()`, `useEnquiries()`, `useCompensations()`, `useCustomers()`
- Mutations: `useCreateFeedback()`, `useResolveFeedback()`, `useCreateEnquiry()`, `useResolveEnquiry()`, `useCreateCompensation()`, `useUpdateCompensationStatus()`

### Audit (`app/(app)/audit/page.tsx`)
- `useAuditLogs(filters)` — pass filter state as query params
- Remove `StorageService.getAuditLogs()`

### Settings (`app/(app)/settings/page.tsx`)
- **Not hub-scoped for Roles/Hubs admin** — global config as documented in backend §5.6
- **Profile tab:** `useAuth().user` (show `hubName`, `role`); `axiosPost('auth/reset-password', ...)`
- **Users tab:** `useAgents()`, `useRoles()`; create user form includes `hub_id` (required for non-admin roles; hub_manager: hub locked to own)
- **Hubs tab:** `useHubs()` — full hub list for `company_admin`; hub_manager may see own hub only (API-scoped)
- **Roles & Permissions tab:** `useRoles()` — unaffected by operational data scope

---

## 10. Files to Delete / Clean Up

| File | Action | Reason |
|------|--------|--------|
| `contexts/AuthContext.tsx` | Delete | Orphan; uses `react-router-dom` + non-existent hooks; conflicts with active auth stack |
| `lib/storage-service.ts` | Delete after migration | No longer needed once all hooks use real API |
| `lib/permissions.ts` — `getRolePermissions`, `saveRolePermissions`, `DEFAULT_ROLE_PERMISSIONS` | Remove these exports | Replaced by `PERMISSION_MAP` + `user.permissions` |

---

## 11. Implementation Order

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

Phase 3 — Permissions & Data Scope UI
  3a. Rewrite lib/permissions.ts (add PERMISSION_MAP, remove localStorage)
  3b. Add hooks/use-data-scope.ts
  3c. Update sidebar user footer (hubName); hub switcher gating on inventory/customers/sales pages
  3d. Update create forms (customer, sale, user, SKU) with hub/assignment defaults

Phase 4 — Hooks (work in dependency order)
  4a. useHubs, useAgents, useRoles  (referenced by most pages)
  4b. useCustomers, useSegments
  4c. useInventory, useStockLogs
  4d. useSales (with due_date validation in create form)
  4e. useCreditSummary, useCustomerCredits, useCreditRecord, useExtendDueDate
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

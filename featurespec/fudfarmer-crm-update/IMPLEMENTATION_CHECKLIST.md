# Fud Farmer CRM Update — Implementation Checklist

Last updated: after **Settings page API wiring** (FE users/hubs/roles/password + BE hub/roles fixes).

Legend: ✅ Done · 🟡 Partial · ⬜ Not started

---

## Backend (`fud-crm-be`)

### Phase 1 — Foundation
| Item | Status |
|------|--------|
| RolesModule + Role schema | ✅ |
| User schema (role ObjectId, hub, is_active) | ✅ |
| AuthGuard + permissions on req.user | ✅ |
| whoami shape | ✅ |
| PermissionGuard + @RequiresPermission | ✅ |
| DataScopeService | ✅ |
| Roles seed + legacy user migration | ✅ |

### Phase 2 — Schema migrations
| Item | Status |
|------|--------|
| Hub CRUD | ✅ |
| Customer (joined_date, counters, hub ObjectId) | ✅ (`assigned_agent` / `added_by` → User refs) |
| Feedback (priority, resolved_by) | ✅ |
| Enquiry (category, managed_by_agent) | ✅ |
| Compensation (amount, recorded_by_agent) | ✅ |
| Lead agent ObjectId ref | ✅ |

### Phase 3 — New modules
| Item | Status |
|------|--------|
| Audit trail | ✅ |
| Inventory | ✅ |
| Sales + auto credit | ✅ |
| Credits | ✅ |
| Tasks | ✅ |

### Phase 4 — Guards & data scope
| Item | Status |
|------|--------|
| PermissionGuard on all writes | ✅ |
| AuthGuard on Enquiry | ✅ (added) |
| AuthGuard on Roles | ✅ |
| DataScope on all list/aggregate endpoints | ✅ (customer, lead, audit, tasks + interactions) |

### Phase 5 — Seed & dashboard
| Item | Status |
|------|--------|
| Default role permissions | ✅ |
| Expanded dashboard metrics | ✅ |

---

## Frontend (`fudfarmer-crm-next`)

### Phase 1–3 — Foundation
| Item | Status |
|------|--------|
| types/api.ts + mapApiUser | ✅ |
| auth-context + middleware + login | ✅ |
| PERMISSION_MAP + useDataScope | ✅ |
| Sidebar hub + credits badge | ✅ |
| Hub switcher gating (inventory/customers/sales) | ✅ |

### Phase 4 — Hooks
| Item | Status |
|------|--------|
| Hubs, customers, inventory, sales, credits | ✅ |
| Feedback / enquiries / compensations (API + local fallback) | ✅ |
| Dashboard metrics | ✅ |
| Settings save hooks (users/hubs/roles) | ✅ |

### Phase 5 — Page wiring
| Page | Status |
|------|--------|
| Dashboard | ✅ |
| Inventory | ✅ |
| Customers | ✅ |
| Sales | ✅ |
| Credits | ✅ |
| **Interactions** | **✅** (this sprint) |
| Audit | ✅ |
| Settings | ✅ |
| Analytics | 🟡 (hooks/API; no StorageService in page) |

### Phase 6 — Cleanup
| Item | Status |
|------|--------|
| Delete storage-service.ts | ✅ |
| Remove legacy permission localStorage from runtime | ✅ |

---

## Recommended next gaps (in order)

1. ~~**BE dashboard metrics**~~ ✅
3. ~~**DataScope everywhere**~~ ✅
4. ~~**FE Phase 6 cleanup**~~ ✅ (storage-service removed; hooks API-only)
5. ~~**Hub switcher gating**~~ ✅
6. ~~**Profile self-service**~~ ✅ (`PATCH /auth/profile`)

---

## Settings sprint notes

- Users: `useCreateAgent` / `useUpdateAgent` / `useDeleteAgent` with `role_id` + `hub_id`.
- Hubs: full list including inactive; `manager_name` text supported on BE.
- Roles: permissions saved via `PATCH /roles/:id` (system roles: permissions only).
- Password: `POST /auth/reset-password` with current + new password (min 8 chars).
- Hub managers: user list scoped by `hub_id`; hub locked on create.
- Data reset: removed with local demo mode; API environment only.

## Interactions sprint notes

- FE uses `useCreateFeedback`, `useResolveFeedback`, `useCreateEnquiry`, `useResolveEnquiry`, `useCreateCompensation`, `useUpdateCompensationStatus`.
- API mode requires **existing CRM customers** (MongoId) for feedback/compensation creates.
- Enquiry create sends `customer_email` (placeholder if empty).
- Compensation API field is `value`; mapper reads `amount` or `value`.
- Priority escalate remains **local-only** until BE adds priority field + PATCH.

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HAS_API, requireApi } from '@/lib/require-api';
import { axiosGet, axiosPost, axiosPatch, axiosDelete, axiosGetBlob, axiosPostForm } from '@/lib/api';
import { customerTypeToApi, customerCompanyNameForApi, customerPhoneForApi } from '@/lib/customer-helpers';
import { mapApiUser } from '@/lib/utils';
import {
  ApiUser,
  ApiResponse,
  ApiCreditCustomerSummary,
  ApiCreditRecord,
  ApiListResponse,
  ApiHub,
  ApiCustomer,
  ApiCustomerListResponse,
  ApiCustomerListSummary,
  ApiSale,
  ApiProduct,
  ApiStockLog,
  ApiUsersListResponse,
  ApiRole,
  ApiFeedback,
  ApiEnquiry,
  ApiCompensation,
  ApiAuditLog,
  ApiTask,
  ApiSegment,
  ApiDashboardMetricsRaw,
  DashboardMetricsData,
  AnalyticsOverviewData,
  EMPTY_ANALYTICS_OVERVIEW,
  ApiBulkImportSaleRow,
  SalesImportValidateResponse,
  SalesImportResult,
  ApiBulkImportMovementRow,
  InventoryImportValidateResponse,
  InventoryImportResult,
  CustomerImportValidateResponse,
  CustomerImportResult,
} from '@/types/api';
import {
  mapCreditCustomerSummary,
  mapCreditRecord,
  buildMetricsFromSummary,
} from '@/lib/credit-mappers';
import {
  feedbackTypeToApi,
  compensationCategoryToApi,
  compensationStatusToApi,
  unwrapApiEntity,
  paginatedList,
} from '@/lib/interaction-payloads';
import {
  mapHub,
  mapCustomer,
  mapSale,
  mapInventoryItem,
  mapStockLog,
  mapAgent,
  mapFeedback,
  mapEnquiry,
  mapCompensation,
  mapAuditLog,
  mapTask,
  mapSegment,
  buildHubMap,
  normalizeDashboardMetrics,
} from '@/lib/api-mappers';
import {
  Compensation,
  Enquiry,
  Hub,
  FeedbackType,
  FeedbackPriority,
  CustomerListResult,
  CustomerListSummary,
  SalesListResult,
  SalesListSummary,
  AuditLogListResult,
  AuditLogListSummary,
} from '../types';


function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
}

type UseQueryEnabledOptions = { enabled?: boolean };

const HUBS_STALE_MS = 5 * 60 * 1000;
const CUSTOMERS_PAGE_SIZE = 20;
export const SALES_PAGE_SIZE = 25;
const AUDIT_PAGE_SIZE = 25;

const EMPTY_SALES_LIST: SalesListResult = {
  items: [],
  meta: { page: 1, limit: SALES_PAGE_SIZE, total: 0, totalPages: 1 },
  summary: {
    revenue: 0,
    profit: 0,
    count: 0,
    avgOrder: 0,
    creditCount: 0,
    creditAmount: 0,
    deliveryCount: 0,
    revenueChange: 0,
    profitChange: 0,
  },
};

const EMPTY_AUDIT_LIST: AuditLogListResult = {
  items: [],
  meta: { page: 1, limit: AUDIT_PAGE_SIZE, total: 0, totalPages: 1 },
  summary: { total: 0, bulk: 0, sales: 0, inventory: 0, customers: 0 },
};

function defaultSalesSummary(): SalesListSummary {
  return EMPTY_SALES_LIST.summary;
}

function defaultAuditSummary(): AuditLogListSummary {
  return EMPTY_AUDIT_LIST.summary;
}

function parseSalesListResponse(
  raw: unknown,
  hubMap: Record<string, string>,
): SalesListResult {
  let body: unknown = raw;
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    'data' in body &&
    !('items' in body)
  ) {
    body = (body as ApiListResponse<{ items: ApiSale[]; pagination?: SalesListResult['meta']; summary?: SalesListSummary }>).data;
  }

  if (body && typeof body === 'object' && 'items' in body) {
    const data = body as {
      items?: ApiSale[];
      pagination?: Partial<SalesListResult['meta']>;
      summary?: Partial<SalesListSummary>;
    };
    const page = data.pagination?.page ?? 1;
    const limit = data.pagination?.limit ?? SALES_PAGE_SIZE;
    const total = data.pagination?.total ?? 0;
    const totalPages = data.pagination?.totalPages ?? Math.max(1, Math.ceil(total / limit));
    return {
      items: (data.items ?? []).map((s) => mapSale(s, hubMap)),
      meta: { page, limit, total, totalPages },
      summary: { ...defaultSalesSummary(), ...(data.summary ?? {}) },
    };
  }

  if (Array.isArray(body)) {
    return {
      items: body.map((s) => mapSale(s as ApiSale, hubMap)),
      meta: { page: 1, limit: body.length, total: body.length, totalPages: 1 },
      summary: defaultSalesSummary(),
    };
  }

  return EMPTY_SALES_LIST;
}

function parseAuditListResponse(
  raw: unknown,
  hubMap: Record<string, string>,
): AuditLogListResult {
  let body: unknown = raw;
  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    'data' in body &&
    !('items' in body)
  ) {
    body = (body as ApiListResponse<{ items: ApiAuditLog[]; pagination?: AuditLogListResult['meta']; summary?: AuditLogListSummary }>).data;
  }

  if (body && typeof body === 'object' && 'items' in body) {
    const data = body as {
      items?: ApiAuditLog[];
      pagination?: Partial<AuditLogListResult['meta']>;
      summary?: Partial<AuditLogListSummary>;
    };
    const page = data.pagination?.page ?? 1;
    const limit = data.pagination?.limit ?? AUDIT_PAGE_SIZE;
    const total = data.pagination?.total ?? 0;
    const totalPages = data.pagination?.totalPages ?? Math.max(1, Math.ceil(total / limit));
    return {
      items: (data.items ?? []).map((l) => mapAuditLog(l, hubMap)),
      meta: { page, limit, total, totalPages },
      summary: { ...defaultAuditSummary(), ...(data.summary ?? {}) },
    };
  }

  if (Array.isArray(body)) {
    return {
      items: body.map((l) => mapAuditLog(l as ApiAuditLog, hubMap)),
      meta: { page: 1, limit: body.length, total: body.length, totalPages: 1 },
      summary: defaultAuditSummary(),
    };
  }

  return EMPTY_AUDIT_LIST;
}

const EMPTY_CUSTOMER_LIST: CustomerListResult = {
  items: [],
  meta: { page: 1, limit: CUSTOMERS_PAGE_SIZE, total: 0, totalPages: 1 },
  summary: { total: 0, b2b: 0, b2c: 0, repeat: 0, totalRevenue: 0, avgValue: 0 },
};

function defaultCustomerListSummary(total: number): CustomerListSummary {
  return { total, b2b: 0, b2c: 0, repeat: 0, totalRevenue: 0, avgValue: 0 };
}

function isPaginatedCustomerList(value: unknown): value is ApiCustomerListResponse {
  return (
    value !== null &&
    typeof value === 'object' &&
    'meta' in value &&
    'data' in value &&
    Array.isArray((value as ApiCustomerListResponse).data)
  );
}

function parseCustomerListResponse(raw: unknown): {
  data: ApiCustomer[];
  meta: CustomerListResult['meta'];
  summary: CustomerListSummary;
} {
  let body: unknown = raw;

  if (
    body &&
    typeof body === 'object' &&
    'message' in body &&
    'data' in body &&
    !('meta' in body)
  ) {
    body = (body as ApiListResponse<ApiCustomerListResponse>).data;
  }

  if (isPaginatedCustomerList(body)) {
    const list = body;
    const meta = list.meta ?? {
      page: 1,
      limit: list.data?.length ?? 0,
      total: 0,
      totalPages: 1,
    };
    return {
      data: list.data ?? [],
      meta,
      summary: list.summary ?? defaultCustomerListSummary(meta.total),
    };
  }

  if (Array.isArray(body)) {
    return {
      data: body,
      meta: { page: 1, limit: body.length, total: body.length, totalPages: 1 },
      summary: defaultCustomerListSummary(body.length),
    };
  }

  return { data: [], meta: EMPTY_CUSTOMER_LIST.meta, summary: EMPTY_CUSTOMER_LIST.summary };
}

async function fetchHubsList(): Promise<Hub[]> {
  if (!HAS_API) return [];
  const res = await axiosGet('hub', true) as ApiListResponse<ApiHub[]>;
  return (res.data ?? []).map(mapHub);
}

async function fetchHubMap(): Promise<Record<string, string>> {
  const hubs = await fetchHubsList();
  return buildHubMap(hubs);
}

function invalidateCredits(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['saleCredits'] });
  qc.invalidateQueries({ queryKey: ['creditSummary'] });
  qc.invalidateQueries({ queryKey: ['creditMetrics'] });
  qc.invalidateQueries({ queryKey: ['credits'] });
}

// --- Auth ---
export function useWhoAmI() {
  return useQuery({
    queryKey: ['whoami'],
    queryFn: async () => {
      const res = await axiosGet('auth/whoami', true) as ApiResponse<ApiUser>;
      return mapApiUser(res.data);
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyticsOverview(filters?: { hub_id?: string }) {
  return useQuery({
    queryKey: ['analyticsOverview', filters],
    queryFn: async () => {
      if (!HAS_API) return EMPTY_ANALYTICS_OVERVIEW;
      const params = new URLSearchParams();
      if (filters?.hub_id) params.set('hub_id', filters.hub_id);
      const qs = params.toString();
      const path = qs ? `analytics/overview?${qs}` : 'analytics/overview';
      const res = await axiosGet(path, true) as ApiResponse<AnalyticsOverviewData>;
      return res.data;
    },
  });
}

// --- Hubs ---
export function useHubs() {
  return useQuery({
    queryKey: ['hubs'],
    queryFn: fetchHubsList,
    staleTime: HUBS_STALE_MS,
  });
}

export function useCreateHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      hub_name: string;
      hub_address?: string;
      hub_phone?: string;
      hub_manager?: string;
      is_active?: boolean;
    }) => {
      requireApi();
      const res = await axiosPost(
        'hub',
        {
          hub_name: dto.hub_name,
          hub_address: dto.hub_address?.trim() || '-',
          hub_phone: dto.hub_phone?.trim() || '-',
          hub_manager: dto.hub_manager,
          is_active: dto.is_active ?? true,
        },
        true,
      ) as ApiListResponse<ApiHub>;
      return mapHub(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubs'] }),
  });
}

export function useUpdateHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: {
      id: string;
      hub_name?: string;
      hub_address?: string;
      hub_phone?: string;
      hub_manager?: string | null;
      is_active?: boolean;
    }) => {
      requireApi();
      const res = await axiosPatch(`hub/${id}`, dto, true) as ApiListResponse<ApiHub>;
      return mapHub(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubs'] }),
  });
}

export function useDeleteHub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      requireApi();
      return axiosDelete(`hub/${id}`, true);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hubs'] }),
  });
}

// --- Roles ---
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      if (!HAS_API) return [];
      const res = await axiosGet('roles', true);
      const list = Array.isArray(res) ? res : (res as ApiListResponse<ApiRole[]>).data ?? [];
      return list as ApiRole[];
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      name: string;
      label: string;
      description?: string;
      permissions?: { module: string; submodules: string[] }[];
    }) => axiosPost('roles', dto, true) as Promise<ApiRole>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      permissions,
      label,
      description,
    }: {
      id: string;
      permissions?: { module: string; submodules: string[] }[];
      label?: string;
      description?: string;
    }) => {
      if (!HAS_API) throw new Error('Role updates require API connection');
      return axiosPatch(`roles/${id}`, { permissions, label, description }, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['whoami'] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => axiosDelete(`roles/${id}`, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
}

// --- Agents (Users) ---
export function useAgents(
  query?: {
    search?: string;
    role_id?: string;
    hub_id?: string;
    status?: string;
    limit?: number;
  },
  options?: UseQueryEnabledOptions,
) {
  return useQuery({
    queryKey: ['agents', query],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      if (!HAS_API) return [];
      const q = { limit: 200, ...query };
      const res = await axiosGet(`users${buildQuery(q)}`, true) as ApiUsersListResponse;
      return (res.users ?? []).map(mapAgent);
    },
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      full_name: string;
      email: string;
      phone: string;
      role_id: string;
      hub_id?: string;
    }) => {
      requireApi();
      return axiosPost('users/create', dto, true);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      full_name,
      email,
      phone,
      role_id,
      hub_id,
      is_active,
    }: {
      id: string;
      full_name?: string;
      email?: string;
      phone?: string;
      role_id?: string;
      hub_id?: string;
      is_active?: boolean;
    }) => {
      requireApi();
      return axiosPatch(
        `users/${id}`,
        { full_name, email, phone, role_id, hub_id, is_active },
        true,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['whoami'] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      requireApi();
      return axiosDelete(`users/${id}`, true);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (dto: { currentPassword: string; newPassword: string }) => {
      requireApi('Password reset');
      return axiosPost('auth/reset-password', dto, true);
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { full_name?: string; phone?: string }) => {
      requireApi('Profile update');
      return axiosPatch('auth/profile', dto, true) as Promise<{ message: string }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whoami'] });
    },
  });
}

// --- Customers ---
export function useCustomers(filters?: {
  search?: string;
  segment_id?: string;
  type?: string;
  hub_id?: string;
  page?: number;
  limit?: number;
}, options?: { enabled?: boolean }) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['customers', filters],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<CustomerListResult> => {
      if (!HAS_API) return EMPTY_CUSTOMER_LIST;
      const hubs = await qc.fetchQuery({
        queryKey: ['hubs'],
        queryFn: fetchHubsList,
        staleTime: HUBS_STALE_MS,
      });
      const hubMap = buildHubMap(hubs);
      const params: Record<string, string | number | undefined> = {
        search: filters?.search,
        customer_type: filters?.type ? customerTypeToApi(filters.type) : undefined,
        hub_id: filters?.hub_id,
        segment_id: filters?.segment_id,
        page: filters?.page,
        limit: filters?.limit,
      };
      const raw = await axiosGet(`customers${buildQuery(params)}`, true);
      const parsed = parseCustomerListResponse(raw);
      return {
        items: parsed.data.map((c) => mapCustomer(c, hubMap)),
        meta: parsed.meta,
        summary: parsed.summary,
      };
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      customer_name: string;
      customer_email?: string;
      customer_phone: string;
      customer_type: string;
      customer_location: string;
      company_name?: string;
      segments?: string[];
      assigned_agent?: string;
    }) => {
      const { company_name, customer_type, ...rest } = dto;
      const res = await axiosPost('customers', {
        ...rest,
        customer_type: customerTypeToApi(customer_type),
        customer_phone: customerPhoneForApi(dto.customer_phone),
        ...customerCompanyNameForApi(customer_type, company_name),
      }, true) as ApiCustomer;
      const hubMap = await fetchHubMap();
      return mapCustomer(res, hubMap);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: {
      id: string;
      customer_name?: string;
      customer_email?: string;
      customer_phone?: string;
      customer_type?: string;
      customer_location?: string;
      company_name?: string;
      segments?: string[];
      assigned_agent?: string;
    }) => {
      const { company_name, customer_type, customer_phone, ...rest } = dto;
      const res = await axiosPatch(`customers/${id}`, {
        ...rest,
        ...(customer_phone !== undefined ? { customer_phone: customerPhoneForApi(customer_phone) } : {}),
        ...(customer_type !== undefined
          ? {
              customer_type: customerTypeToApi(customer_type),
              ...customerCompanyNameForApi(customer_type, company_name),
            }
          : {}),
      }, true) as ApiCustomer;
      const hubMap = await fetchHubMap();
      return mapCustomer(res, hubMap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDownloadCustomerImportTemplate() {
  return useMutation({
    mutationFn: async () => {
      const buffer = await axiosGetBlob('customers/import/template', true);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customer-name-import-template.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  });
}

export function useValidateCustomerImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const res = await axiosPostForm('customers/import/validate', form, true) as ApiListResponse<CustomerImportValidateResponse> | CustomerImportValidateResponse;
      return unwrapImportResponse(res);
    },
  });
}

export function useImportCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: unknown[]) =>
      unwrapImportResponse(await axiosPost('customers/import', { rows }, true)) as CustomerImportResult,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['auditLogs'] });
      qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
  });
}

export function useSegments() {
  return useQuery({
    queryKey: ['segments'],
    queryFn: async () => {
      if (!HAS_API) return [];
      const raw = await axiosGet('customers/segments', true);
      const list: ApiSegment[] = Array.isArray(raw) ? raw : (raw as ApiListResponse<ApiSegment[]>).data ?? [];
      return list.map(mapSegment);
    },
  });
}

export function useCreateSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { name: string }) => axiosPost('customers/segments', dto, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segments'] }),
  });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => axiosDelete(`customers/segments/${id}`, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['segments'] }),
  });
}

// --- Sales ---
export function useSales(
  filters?: {
    status?: string;
    date_from?: string;
    date_to?: string;
    date_field?: string;
    payment_mode?: string;
    hub_id?: string;
    agent_id?: string;
    channel?: string;
    search?: string;
    exclude_voided?: boolean;
    page?: number;
    limit?: number;
  },
  options?: UseQueryEnabledOptions,
) {
  return useQuery({
    queryKey: ['sales', filters],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<SalesListResult> => {
      if (!HAS_API) return EMPTY_SALES_LIST;
      const hubMap = await fetchHubMap();
      const params: Record<string, string | number | boolean | undefined> = {
        status: filters?.status,
        date_from: filters?.date_from,
        date_to: filters?.date_to,
        date_field: filters?.date_field,
        payment_mode: filters?.payment_mode,
        hub_id: filters?.hub_id,
        agent_id: filters?.agent_id,
        channel: filters?.channel,
        search: filters?.search,
        exclude_voided: filters?.exclude_voided,
        page: filters?.page,
        limit: filters?.limit,
      };
      const raw = await axiosGet(`sales${buildQuery(params)}`, true);
      return parseSalesListResponse(raw, hubMap);
    },
  });
}

export function useCreateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      customer_id: string;
      hub_id: string;
      amount: number;
      amount_paid?: number;
      payment_mode: string;
      payment_type?: string;
      due_date?: string;
      payment_terms?: string;
      channel?: string;
      delivery_status?: string;
      delivery_address?: string;
      notes?: string;
      profit_margin?: number;
      profit_amount?: number;
      date?: string;
      product_details?: string;
      items?: { product_id: string; quantity: number; unit_price: number }[];
    }) => {
      const res = await axiosPost('sales', dto, true) as ApiListResponse<{ sale: ApiSale; credit_record?: ApiCreditRecord }>;
      return {
        sale: mapSale(res.data.sale),
        creditRecord: res.data.credit_record ? mapCreditRecord(res.data.credit_record) : undefined,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stockLogs'] });
      invalidateCredits(qc);
      qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
  });
}

export function useUpdateSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; [key: string]: unknown }) => {
      const res = await axiosPatch(`sales/${id}`, dto, true) as ApiListResponse<ApiSale>;
      const hubMap = await fetchHubMap();
      return mapSale(res.data, hubMap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

export function useUpdateSaleStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await axiosPatch(`sales/${id}/status`, { status }, true) as ApiListResponse<ApiSale>;
      return mapSale(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

export function useUpdateDeliveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, delivery_status, delivery_address }: { id: string; delivery_status: string; delivery_address?: string }) => {
      const res = await axiosPatch(`sales/${id}/delivery`, { delivery_status, delivery_address }, true) as ApiListResponse<ApiSale>;
      return mapSale(res.data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales'] }),
  });
}

export function useVoidSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await axiosPatch(`sales/${id}/void`, {}, true) as ApiListResponse<ApiSale>;
      return mapSale(res.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['stockLogs'] });
      invalidateCredits(qc);
    },
  });
}

function invalidateSalesImportQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['sales'] });
  qc.invalidateQueries({ queryKey: ['customers'] });
  qc.invalidateQueries({ queryKey: ['inventory'] });
  qc.invalidateQueries({ queryKey: ['stockLogs'] });
  invalidateCredits(qc);
  qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
}

function unwrapImportResponse<T>(response: ApiListResponse<T> | T): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as ApiListResponse<T>).data;
  }
  return response as T;
}

export function useDownloadSalesImportTemplate() {
  return useMutation({
    mutationFn: async (type: 'catalog' | 'custom' = 'catalog') => {
      requireApi();
      const buffer = await axiosGetBlob(`sales/import/template?type=${type}`, true);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales-import-${type}-template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useValidateSalesImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      requireApi();
      const form = new FormData();
      form.append('file', file);
      const res = await axiosPostForm('sales/import/validate', form, true) as ApiListResponse<SalesImportValidateResponse> | SalesImportValidateResponse;
      return unwrapImportResponse(res);
    },
  });
}

export function useImportSales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ApiBulkImportSaleRow[]) => {
      requireApi();
      const res = await axiosPost('sales/import', { rows }, true) as ApiListResponse<SalesImportResult> | SalesImportResult;
      return unwrapImportResponse(res);
    },
    onSuccess: () => invalidateSalesImportQueries(qc),
  });
}

function invalidateInventoryImportQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['inventory'] });
  qc.invalidateQueries({ queryKey: ['stockLogs'] });
  qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
}

export function useDownloadInventoryImportTemplate() {
  return useMutation({
    mutationFn: async () => {
      requireApi();
      const buffer = await axiosGetBlob('inventory/import/template', true);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inventory-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useValidateInventoryImport() {
  return useMutation({
    mutationFn: async (file: File) => {
      requireApi();
      const form = new FormData();
      form.append('file', file);
      const res = await axiosPostForm('inventory/import/validate', form, true) as ApiListResponse<InventoryImportValidateResponse> | InventoryImportValidateResponse;
      return unwrapImportResponse(res);
    },
  });
}

export function useImportInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ApiBulkImportMovementRow[]) => {
      requireApi();
      const res = await axiosPost('inventory/import', { rows }, true) as ApiListResponse<InventoryImportResult> | InventoryImportResult;
      return unwrapImportResponse(res);
    },
    onSuccess: () => invalidateInventoryImportQueries(qc),
  });
}

// --- Inventory ---
export function useInventory(filters?: { hub_id?: string; category?: string; low_stock?: boolean; search?: string }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['inventory', filters],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      if (!HAS_API) return [];
      const hubMap = await fetchHubMap();
      const params: Record<string, string | boolean | undefined> = {
        hub_id: filters?.hub_id,
        category: filters?.category,
        search: filters?.search,
        low_stock: filters?.low_stock ? 'true' : undefined,
      };
      const res = await axiosGet(`inventory${buildQuery(params)}`, true) as ApiListResponse<ApiProduct[]>;
      return (res.data ?? []).map((p) => mapInventoryItem(p, hubMap));
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: object) => {
      const res = await axiosPost('inventory', dto, true) as ApiListResponse<ApiProduct>;
      const hubMap = await fetchHubMap();
      return mapInventoryItem(res.data, hubMap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string; [key: string]: unknown }) => {
      const res = await axiosPatch(`inventory/${id}`, dto, true) as ApiListResponse<ApiProduct>;
      const hubMap = await fetchHubMap();
      return mapInventoryItem(res.data, hubMap);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  });
}

export function useStockLogs(filters?: { item_id?: string; hub_id?: string; type?: string; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: ['stockLogs', filters],
    queryFn: async () => {
      if (!HAS_API) return [];
      const res = await axiosGet(`inventory/stock-logs${buildQuery(filters ?? {})}`, true) as ApiListResponse<ApiStockLog[]>;
      return (res.data ?? []).map(mapStockLog);
    },
  });
}

export function useRecordStockMove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: object) => {
      const res = await axiosPost('inventory/stock-logs', dto, true) as ApiListResponse<ApiStockLog>;
      return mapStockLog(res.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockLogs'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: object) => axiosPost('inventory/transfer', dto, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockLogs'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useBatchStockUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: object) => axiosPost('inventory/batch', dto, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stockLogs'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

// --- Credits (API with local fallback when no API_URL) ---
export function useSaleCredits() {
  return useQuery({
    queryKey: ['saleCredits'],
    queryFn: async () => {
      if (!HAS_API) return [];
      const summaryRes = await axiosGet('credits/summary', true) as ApiListResponse<ApiCreditCustomerSummary[]>;
      const all: ReturnType<typeof mapCreditRecord>[] = [];
      for (const row of summaryRes.data) {
        const res = await axiosGet(`credits?customer_id=${row.customer_id}`, true) as ApiListResponse<ApiCreditRecord[]>;
        all.push(...res.data.map(mapCreditRecord));
      }
      return all;
    },
  });
}

export function useCreditSummary(filters?: { search?: string; flagged?: boolean }) {
  return useQuery({
    queryKey: ['creditSummary', filters],
    queryFn: async () => {
      if (!HAS_API) return [];
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.flagged) params.set('flagged', 'true');
      const qs = params.toString();
      const path = qs ? `credits/summary?${qs}` : 'credits/summary';
      const res = await axiosGet(path, true) as ApiListResponse<ApiCreditCustomerSummary[]>;
      return res.data.map(mapCreditCustomerSummary);
    },
  });
}

export function useCreditMetrics() {
  return useQuery({
    queryKey: ['creditMetrics'],
    queryFn: async () => {
      if (!HAS_API) return buildMetricsFromSummary([]);
      const res = await axiosGet('credits/summary', true) as ApiListResponse<ApiCreditCustomerSummary[]>;
      return buildMetricsFromSummary(res.data.map(mapCreditCustomerSummary));
    },
  });
}

export function useCustomerCredits(customerId: string | null, filters?: { status?: string }) {
  return useQuery({
    queryKey: ['saleCredits', 'customer', customerId, filters],
    queryFn: async () => {
      if (!customerId) return [];
      if (!HAS_API) return [];
      const qs = filters?.status ? `&status=${filters.status}` : '';
      const res = await axiosGet(`credits?customer_id=${customerId}${qs}`, true) as ApiListResponse<ApiCreditRecord[]>;
      return res.data.map(mapCreditRecord);
    },
    enabled: !!customerId,
  });
}

export function useCreditRecord(id: string | null) {
  return useQuery({
    queryKey: ['saleCredits', 'detail', id],
    queryFn: async () => {
      if (!id) return undefined;
      if (!HAS_API) return null;
      const res = await axiosGet(`credits/${id}`, true) as ApiListResponse<ApiCreditRecord>;
      return mapCreditRecord(res.data);
    },
    enabled: !!id,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      creditId,
      amount,
      method,
      note,
      recordedBy,
      recordedByName,
    }: {
      creditId: string;
      amount: number;
      method: 'Cash' | 'Transfer' | 'POS';
      note?: string;
      recordedBy: string;
      recordedByName: string;
    }) => {
      requireApi();
      const res = await axiosPost(`credits/${creditId}/payment`, { amount, method, note }, true) as ApiListResponse<ApiCreditRecord>;
      return mapCreditRecord(res.data);
    },
    onSuccess: () => invalidateCredits(qc),
  });
}

export function useExtendDueDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      creditId,
      newDueDate,
      reason,
      extendedByName,
    }: {
      creditId: string;
      newDueDate: string;
      reason?: string;
      extendedByName: string;
    }) => {
      requireApi();
      const res = await axiosPatch(`credits/${creditId}/extend-due-date`, { new_due_date: newDueDate, reason }, true) as ApiListResponse<ApiCreditRecord>;
      return mapCreditRecord(res.data);
    },
    onSuccess: () => invalidateCredits(qc),
  });
}

export function useFlagCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ creditId, reason }: { creditId: string; reason?: string }) => {
      requireApi();
      const res = await axiosPatch(`credits/${creditId}/flag`, { flag_reason: reason }, true) as ApiListResponse<ApiCreditRecord>;
      return mapCreditRecord(res.data);
    },
    onSuccess: () => invalidateCredits(qc),
  });
}

// --- Feedback ---
export function useFeedback(filters?: { status?: string }, options?: UseQueryEnabledOptions) {
  return useQuery({
    queryKey: ['feedback', filters],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      if (!HAS_API) return [];
      const raw = await axiosGet(`feedbacks${buildQuery(filters ?? {})}`, true);
      return paginatedList<ApiFeedback>(raw).map(mapFeedback);
    },
  });
}

export function useCreateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      customerId: string;
      customerName: string;
      type: FeedbackType;
      content: string;
      priority?: FeedbackPriority;
    }) => {
      const priorityMap: Record<FeedbackPriority, string> = {
        [FeedbackPriority.LOW]: 'Low',
        [FeedbackPriority.MEDIUM]: 'Medium',
        [FeedbackPriority.HIGH]: 'High',
        [FeedbackPriority.URGENT]: 'Urgent',
      };
      requireApi();
      const raw = await axiosPost(
        'feedbacks',
        {
          customer: dto.customerId,
          type: feedbackTypeToApi(dto.type),
          content: dto.content,
          ...(dto.priority ? { priority: priorityMap[dto.priority] } : {}),
        },
        true,
      );
      return mapFeedback(unwrapApiEntity<ApiFeedback>(raw));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      qc.invalidateQueries({ queryKey: ['dashboardMetrics'] });
    },
  });
}

export function useUpdateFeedbackPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: FeedbackPriority }) => {
      const priorityMap: Record<FeedbackPriority, string> = {
        [FeedbackPriority.LOW]: 'Low',
        [FeedbackPriority.MEDIUM]: 'Medium',
        [FeedbackPriority.HIGH]: 'High',
        [FeedbackPriority.URGENT]: 'Urgent',
      };
      requireApi();
      const raw = await axiosPatch(
        `feedbacks/${id}/priority`,
        { priority: priorityMap[priority] },
        true,
      );
      return mapFeedback(unwrapApiEntity<ApiFeedback>(raw));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

export function useResolveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      requireApi();
      const raw = await axiosPatch(`feedbacks/${id}/resolve`, { resolution }, true);
      return mapFeedback(unwrapApiEntity<ApiFeedback>(raw));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback'] }),
  });
}

// --- Enquiries ---
/** Backend list endpoints cap limit at 100 (see ListCompensationQueryDto). */
const INTERACTION_LIST_LIMIT = 100;

export function useEnquiries(filters?: { status?: string }, options?: UseQueryEnabledOptions) {
  return useQuery({
    queryKey: ['enquiries', filters],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      if (!HAS_API) return [];
      const q = { page: 1, limit: INTERACTION_LIST_LIMIT, ...filters };
      const raw = await axiosGet(`enquiries${buildQuery(q)}`, true);
      return paginatedList<ApiEnquiry>(raw).map(mapEnquiry);
    },
  });
}

export function useCreateEnquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      customerName: string;
      email?: string;
      subject?: string;
      message: string;
      date?: string;
      category?: Enquiry['category'];
    }) => {
      requireApi();
      const raw = await axiosPost(
        'enquiries',
        {
          customer_name: dto.customerName,
          customer_email: dto.email?.trim() || 'noreply@fudfarmer.local',
          date: dto.date || new Date().toISOString().split('T')[0],
          subject: dto.subject || 'General Enquiry',
          message: dto.message,
        },
        true,
      );
      return mapEnquiry(unwrapApiEntity<ApiEnquiry>(raw));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  });
}

export function useResolveEnquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => {
      requireApi();
      const raw = await axiosPatch(`enquiries/${id}/resolve`, { resolution }, true);
      return mapEnquiry(unwrapApiEntity<ApiEnquiry>(raw));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enquiries'] }),
  });
}

// --- Compensations ---
export function useCompensations(filters?: { status?: string }, options?: UseQueryEnabledOptions) {
  return useQuery({
    queryKey: ['compensations', filters],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      if (!HAS_API) return [];
      const q = { page: 1, limit: INTERACTION_LIST_LIMIT, ...filters };
      const raw = await axiosGet(`compensations${buildQuery(q)}`, true);
      return paginatedList<ApiCompensation>(raw).map(mapCompensation);
    },
  });
}

export function useCreateCompensation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      customerId: string;
      customerName: string;
      reason: string;
      amount: number;
      status: Compensation['status'];
      category: Compensation['category'];
      recordedByAgentId?: string;
      recordedByAgentName?: string;
    }) => {
      requireApi();
      const raw = await axiosPost(
        'compensations',
        {
          customer: dto.customerId,
          category: compensationCategoryToApi(dto.category),
          reason: dto.reason,
          value: dto.amount,
          status: compensationStatusToApi(dto.status),
        },
        true,
      );
      return mapCompensation(unwrapApiEntity<ApiCompensation>(raw));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compensations'] }),
  });
}

export function useUpdateCompensationStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Compensation['status'] }) => {
      requireApi();
      const raw = await axiosPatch(
        `compensations/${id}/status`,
        { status: compensationStatusToApi(status) },
        true,
      );
      return mapCompensation(unwrapApiEntity<ApiCompensation>(raw));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['compensations'] }),
  });
}

// --- Audit Logs ---
export function useAuditLogs(filters?: {
  entity_type?: string;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  category?: string;
  bulk_domain?: string;
  import_type?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['auditLogs', filters],
    queryFn: async (): Promise<AuditLogListResult> => {
      if (!HAS_API) return EMPTY_AUDIT_LIST;
      const hubMap = await fetchHubMap();
      const params: Record<string, string | number | undefined> = {
        entity_type: filters?.entity_type,
        user_id: filters?.user_id,
        date_from: filters?.date_from,
        date_to: filters?.date_to,
        search: filters?.search,
        category: filters?.category,
        bulk_domain: filters?.bulk_domain,
        import_type: filters?.import_type,
        page: filters?.page,
        limit: filters?.limit,
      };
      const raw = await axiosGet(`audit-trail${buildQuery(params)}`, true);
      return parseAuditListResponse(raw, hubMap);
    },
  });
}

// --- Tasks ---
export function useTasks(filters?: { assigned_to?: string; status?: string }) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      if (!HAS_API) return [];
      const raw = await axiosGet(`tasks${buildQuery(filters ?? {})}`, true);
      const list: ApiTask[] = Array.isArray(raw) ? raw : (raw as ApiListResponse<ApiTask[]>).data ?? [];
      return list.map(mapTask);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: object) => {
      const raw = await axiosPost('tasks', dto, true);
      return mapTask(raw as ApiTask);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: { id: string } & object) => {
      const raw = await axiosPatch(`tasks/${id}`, dto, true);
      return mapTask(raw as ApiTask);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => axiosDelete(`tasks/${id}`, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// --- Dashboard ---
export function useDashboardMetrics(): ReturnType<typeof useQuery<DashboardMetricsData>> {
  return useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async (): Promise<DashboardMetricsData> => {
      requireApi();

      const [
        metricsRaw,
        creditSummaryRes,
        inventoryRes,
        feedbackRaw,
        enquiryRaw,
        customerRaw,
        salesRes,
      ] = await Promise.all([
        axiosGet('dashboard/metrics', true) as Promise<ApiDashboardMetricsRaw>,
        axiosGet('credits/summary', true) as Promise<ApiListResponse<ApiCreditCustomerSummary[]>>,
        axiosGet('inventory', true) as Promise<ApiListResponse<ApiProduct[]>>,
        axiosGet('feedbacks', true),
        axiosGet('enquiries', true),
        axiosGet('customers', true),
        axiosGet('sales', true) as Promise<ApiListResponse<{ items: ApiSale[] }>>,
      ]);

      const hubMap = await fetchHubMap();
      const inventory = (inventoryRes.data ?? []).map((p) => mapInventoryItem(p, hubMap));
      const feedbackList: ApiFeedback[] = Array.isArray(feedbackRaw) ? feedbackRaw : (feedbackRaw as ApiListResponse<ApiFeedback[]>).data ?? [];
      const enquiryList: ApiEnquiry[] = Array.isArray(enquiryRaw) ? enquiryRaw : (enquiryRaw as ApiListResponse<ApiEnquiry[]>).data ?? [];
      const customerList = parseCustomerListResponse(customerRaw);
      const customers = customerList.data.map((c) => mapCustomer(c, hubMap));
      const sales = (salesRes.data?.items ?? []).map((s) => mapSale(s, hubMap));

      return normalizeDashboardMetrics(metricsRaw, {
        creditSummary: creditSummaryRes.data,
        inventory,
        feedbacks: feedbackList.map(mapFeedback),
        enquiries: enquiryList.map(mapEnquiry),
        customers,
        sales,
      });
    },
  });
}

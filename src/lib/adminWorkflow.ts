export type ApprovalRequestType =
  | 'testimonial'
  | 'event'
  | 'admin_user'
  | 'leadership_delete'
  | 'workforce_delete'
  | 'form_delete'
  | 'form_submission_delete'
  | string;

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'deleted' | string;

export type ApprovalActionLink = {
  label?: string;
  method?: string;
  url?: string;
};

export type ApprovalRequestActions = {
  approve?: string | ApprovalActionLink;
  reject?: string | ApprovalActionLink;
  delete?: string | ApprovalActionLink;
  view?: string | ApprovalActionLink;
};

export type ApprovalRequest = {
  id: string;
  ticketCode?: string;
  ticket_code?: string;
  type: ApprovalRequestType;
  status: ApprovalRequestStatus;
  entityId?: string | null;
  entity_id?: string | null;
  entityLabel?: string | null;
  entity_label?: string | null;
  requestedById?: string | null;
  requested_by_id?: string | null;
  requestedByName?: string | null;
  requested_by_name?: string | null;
  requestedByEmail?: string | null;
  requested_by_email?: string | null;
  approvedByName?: string | null;
  approved_by_name?: string | null;
  approvedByEmail?: string | null;
  approved_by_email?: string | null;
  approvedAt?: string | null;
  approved_at?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  approveAction?: ApprovalActionLink;
  rejectAction?: ApprovalActionLink;
  deleteAction?: ApprovalActionLink;
  actions?: ApprovalRequestActions;
};

export type ApprovalRequestDetail = ApprovalRequest & {
  target?: unknown;
};

export type ApprovalTimelinePoint = { day: string; count: number };

export type ApprovalRequestsTimeline = {
  start?: string;
  end?: string;
  created?: ApprovalTimelinePoint[];
  approved?: ApprovalTimelinePoint[];
};

type JsonRecord = Record<string, unknown>;

const RAW_API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
const USE_API_PROXY = process.env.NEXT_PUBLIC_API_PROXY !== 'false';
const DEFAULT_CSRF_HEADER = 'X-CSRF-Token';

let csrfTokenCache: string | null = null;
let csrfHeaderNameCache = DEFAULT_CSRF_HEADER;

function normalizeOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) base = base.slice(0, -'/api/v1'.length);
  return base;
}

const API_ORIGIN = RAW_API_ORIGIN ? normalizeOrigin(RAW_API_ORIGIN) : '';
const API_V1_BASE_URL = USE_API_PROXY ? '/api/v1' : `${API_ORIGIN}/api/v1`;

function apiUrl(path: string): string {
  const cleanPath = String(path || '').trim();
  if (!cleanPath) return API_V1_BASE_URL;
  if (/^https?:\/\//i.test(cleanPath)) return cleanPath;

  const normalized = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  if (normalized === '/api/v1' || normalized.startsWith('/api/v1/')) return normalized;
  return `${API_V1_BASE_URL}${normalized}`;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function stringValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

function unwrap<T>(payload: unknown): T {
  if (isRecord(payload) && 'data' in payload) return payload.data as T;
  return payload as T;
}

function normalizeArray<T>(value: unknown): T[] {
  const data = unwrap<unknown>(value);
  if (Array.isArray(data)) return data as T[];

  if (isRecord(data)) {
    const list = data.data ?? data.items ?? data.results ?? data.records ?? data.rows;
    if (Array.isArray(list)) return list as T[];
  }

  return [];
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) return fallback;

  const directMessage = stringValue(payload.message);
  if (directMessage) return directMessage;

  const directError = stringValue(payload.error);
  if (directError) return directError;

  if (isRecord(payload.data)) {
    const nestedMessage = stringValue(payload.data.message);
    if (nestedMessage) return nestedMessage;

    const nestedError = stringValue(payload.data.error);
    if (nestedError) return nestedError;
  }

  return fallback;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

function envelopeData(payload: unknown): JsonRecord {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  if (isRecord(payload)) return payload;
  return {};
}

function extractCsrfToken(payload: JsonRecord): string {
  return (
    stringValue(payload.token) ||
    stringValue(payload.csrfToken) ||
    stringValue(payload.csrf_token) ||
    stringValue(payload.csrf) ||
    ''
  );
}

function extractCsrfHeader(payload: JsonRecord): string {
  return (
    stringValue(payload.header) ||
    stringValue(payload.headerName) ||
    stringValue(payload.header_name) ||
    stringValue(payload.csrfHeader) ||
    stringValue(payload.csrf_header) ||
    DEFAULT_CSRF_HEADER
  );
}

function actionURL(action?: string | ApprovalActionLink): string {
  if (!action) return '';
  if (typeof action === 'string') return action.trim();
  return stringValue(action.url);
}

function actionMethod(action: string | ApprovalActionLink | undefined, fallback: string): string {
  if (!action || typeof action === 'string') return fallback.toUpperCase();
  return (stringValue(action.method) || fallback).toUpperCase();
}

function normalizeActionPath(action?: string | ApprovalActionLink): string {
  const url = actionURL(action);
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return url.replace(/^\/api\/v1/, '') || '/';
}

export class AdminWorkflowApiError extends Error {
  statusCode?: number;
  details?: unknown;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'AdminWorkflowApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

async function requestCsrfToken(forceRefresh = false): Promise<{ token: string; header: string } | null> {
  if (!forceRefresh && csrfTokenCache) {
    return { token: csrfTokenCache, header: csrfHeaderNameCache };
  }

  const response = await fetch(apiUrl('/auth/csrf-token'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return null;

  const payload = await safeJson(response);
  const data = envelopeData(payload);
  const token = extractCsrfToken(data);
  const header = extractCsrfHeader(data);

  if (!token) return null;

  csrfTokenCache = token;
  csrfHeaderNameCache = header || DEFAULT_CSRF_HEADER;
  return { token: csrfTokenCache, header: csrfHeaderNameCache };
}

async function request<T>(path: string, options: RequestInit = {}, retryingAfterCsrfRefresh = false): Promise<T> {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  headers.set('Accept', 'application/json');

  if (method !== 'GET' && method !== 'HEAD') {
    if (!headers.has('Content-Type') && options.body) headers.set('Content-Type', 'application/json');

    const csrf = await requestCsrfToken(retryingAfterCsrfRefresh);
    if (csrf) headers.set(csrf.header, csrf.token);
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    method,
    credentials: 'include',
    cache: 'no-store',
    headers,
  });

  const payload = await safeJson(response);

  if (!response.ok) {
    const shouldRetryWithFreshCsrf =
      (response.status === 401 || response.status === 403) &&
      !retryingAfterCsrfRefresh &&
      method !== 'GET' &&
      method !== 'HEAD';

    if (shouldRetryWithFreshCsrf) {
      csrfTokenCache = null;
      return request<T>(path, options, true);
    }

    if (response.status === 401 || response.status === 403) csrfTokenCache = null;

    throw new AdminWorkflowApiError(
      messageFromPayload(payload, `Request failed with status ${response.status}`),
      response.status,
      payload
    );
  }

  return unwrap<T>(payload);
}

export function requestTicketCode(requestItem: ApprovalRequest): string {
  return String(requestItem.ticketCode ?? requestItem.ticket_code ?? requestItem.id ?? '').trim();
}

export function requestEntityId(requestItem: ApprovalRequest): string {
  return String(requestItem.entityId ?? requestItem.entity_id ?? '').trim();
}

export function requestEntityLabel(requestItem: ApprovalRequest): string {
  return String(requestItem.entityLabel ?? requestItem.entity_label ?? requestTicketCode(requestItem) ?? '').trim();
}

export function requestRequesterName(requestItem: ApprovalRequest): string {
  return String(requestItem.requestedByName ?? requestItem.requested_by_name ?? '').trim();
}

export function requestRequesterEmail(requestItem: ApprovalRequest): string {
  return String(requestItem.requestedByEmail ?? requestItem.requested_by_email ?? '').trim();
}

export function requestCreatedAt(requestItem: ApprovalRequest): string {
  return String(requestItem.createdAt ?? requestItem.created_at ?? '').trim();
}

export function requestUpdatedAt(requestItem: ApprovalRequest): string {
  return String(requestItem.updatedAt ?? requestItem.updated_at ?? '').trim();
}

export function requestApprovedAt(requestItem: ApprovalRequest): string {
  return String(requestItem.approvedAt ?? requestItem.approved_at ?? '').trim();
}

export function requestApproverName(requestItem: ApprovalRequest): string {
  return String(requestItem.approvedByName ?? requestItem.approved_by_name ?? '').trim();
}

export function requestApproverEmail(requestItem: ApprovalRequest): string {
  return String(requestItem.approvedByEmail ?? requestItem.approved_by_email ?? '').trim();
}

function requireEntityId(requestItem: ApprovalRequest, label: string): string {
  const entityId = requestEntityId(requestItem);
  if (!entityId) throw new AdminWorkflowApiError(`${label} id is missing from approval request`, 400, requestItem);
  return entityId;
}

function requestByConfiguredAction(
  action: string | ApprovalActionLink | undefined,
  fallbackMethod: 'POST' | 'PATCH' | 'DELETE',
  body?: string
): Promise<unknown> | null {
  const path = normalizeActionPath(action);
  if (!path) return null;

  return request(path, {
    method: actionMethod(action, fallbackMethod),
    ...(body !== undefined ? { body } : {}),
  });
}

export const adminWorkflowApi = {
  async listApprovalRequests(params?: {
    type?: ApprovalRequestType | 'all';
    status?: ApprovalRequestStatus | 'all';
    limit?: number;
  }): Promise<ApprovalRequest[]> {
    const path = `/admin/requests${query({
      type: params?.type && params.type !== 'all' ? params.type : undefined,
      status: params?.status && params.status !== 'all' ? params.status : undefined,
      limit: params?.limit ?? 200,
    })}`;

    return normalizeArray<ApprovalRequest>(await request<unknown>(path));
  },

  async getApprovalRequest(id: string): Promise<ApprovalRequestDetail> {
    const cleanId = String(id || '').trim();
    if (!cleanId) throw new AdminWorkflowApiError('Approval request id is required', 400);
    return request<ApprovalRequestDetail>(`/admin/requests/${encodeURIComponent(cleanId)}`);
  },

  async getApprovalTimeline(days = 14): Promise<ApprovalRequestsTimeline> {
    return request<ApprovalRequestsTimeline>(`/admin/requests/timeline?days=${encodeURIComponent(String(days))}`);
  },

  async approveRequest(requestItem: ApprovalRequest): Promise<unknown> {
    const configuredAction = requestByConfiguredAction(
      requestItem.approveAction ?? requestItem.actions?.approve,
      'POST',
      '{}'
    );

    if (configuredAction) return configuredAction;

    switch (requestItem.type) {
      case 'admin_user': {
        const entityId = requireEntityId(requestItem, 'Admin user');
        return request(`/admin/users/${encodeURIComponent(entityId)}/approve`, { method: 'POST', body: '{}' });
      }
      case 'event': {
        const entityId = requireEntityId(requestItem, 'Event');
        return request(`/admin/events/${encodeURIComponent(entityId)}/approve`, { method: 'PATCH', body: '{}' });
      }
      case 'testimonial': {
        const entityId = requireEntityId(requestItem, 'Testimonial');
        return request(`/admin/testimonials/${encodeURIComponent(entityId)}/approve`, { method: 'PATCH', body: '{}' });
      }
      case 'leadership_delete': {
        const entityId = requestEntityId(requestItem) || requestItem.id;
        return request(`/admin/leadership/${encodeURIComponent(entityId)}/delete/approve`, { method: 'POST', body: '{}' });
      }
      case 'workforce_delete': {
        const entityId = requestEntityId(requestItem) || requestItem.id;
        return request(`/admin/workforce/${encodeURIComponent(entityId)}/delete/approve`, { method: 'POST', body: '{}' });
      }
      case 'form_delete':
      case 'form_submission_delete':
        return request(`/admin/requests/${encodeURIComponent(requestItem.id)}/approve`, { method: 'POST', body: '{}' });
      default:
        throw new AdminWorkflowApiError(`No approve action is configured for ${requestItem.type}`, 400, requestItem);
    }
  },

  async rejectRequest(requestItem: ApprovalRequest, reason: string): Promise<unknown> {
    const body = JSON.stringify({ reason: reason.trim() || 'Request was not approved.' });

    const configuredAction = requestByConfiguredAction(
      requestItem.rejectAction ?? requestItem.actions?.reject,
      'POST',
      body
    );

    if (configuredAction) return configuredAction;

    switch (requestItem.type) {
      case 'admin_user': {
        const entityId = requireEntityId(requestItem, 'Admin user');
        return request(`/admin/users/${encodeURIComponent(entityId)}/reject`, { method: 'POST', body });
      }
      // leadership_delete / workforce_delete intentionally fall through to the
      // generic approval-request reject below (not a type-specific "decline"
      // endpoint): rejecting a delete request should only dismiss the pending
      // request and leave the member/worker record untouched. The leadership
      // "/decline" endpoint instead flips the member's own status to
      // declined — the right action for rejecting a leadership *application*,
      // not for rejecting a request to delete an existing record.
      default:
        return request(`/admin/requests/${encodeURIComponent(requestItem.id)}/reject`, { method: 'POST', body });
    }
  },

  async deleteRequest(requestItem: ApprovalRequest): Promise<unknown> {
    const configuredAction = requestByConfiguredAction(requestItem.deleteAction ?? requestItem.actions?.delete, 'DELETE');
    if (configuredAction) return configuredAction;
    return request(`/admin/requests/${encodeURIComponent(requestItem.id)}`, { method: 'DELETE' });
  },

  async deleteFormSubmission(formId: string, submissionId: string): Promise<unknown> {
    const cleanFormId = String(formId || '').trim();
    const cleanSubmissionId = String(submissionId || '').trim();

    if (!cleanSubmissionId) throw new AdminWorkflowApiError('Submission id is required', 400);

    if (cleanFormId) {
      return request(
        `/admin/forms/${encodeURIComponent(cleanFormId)}/submissions/${encodeURIComponent(cleanSubmissionId)}`,
        { method: 'DELETE' }
      );
    }

    return request(`/admin/forms/submissions/${encodeURIComponent(cleanSubmissionId)}`, { method: 'DELETE' });
  },
};

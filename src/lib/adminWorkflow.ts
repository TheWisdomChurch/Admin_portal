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

export type ApprovalRequestActions = {
  approve?: string;
  reject?: string;
  delete?: string;
  view?: string;
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
  actions?: ApprovalRequestActions;
};

export type ApprovalRequestDetail = ApprovalRequest & {
  target?: unknown;
  actions?: ApprovalRequestActions;
};

export type ApprovalTimelinePoint = {
  day: string;
  count: number;
};

export type ApprovalRequestsTimeline = {
  start?: string;
  end?: string;
  created?: ApprovalTimelinePoint[];
  approved?: ApprovalTimelinePoint[];
};

type ApiEnvelope<T = unknown> = {
  status?: string;
  message?: string;
  data?: T;
  error?: string;
  statusCode?: number;
};

type JsonRecord = Record<string, unknown>;

const RAW_API_ORIGIN =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  '';

const USE_API_PROXY = process.env.NEXT_PUBLIC_API_PROXY !== 'false';

let csrfTokenCache: string | null = null;
let csrfHeaderNameCache = 'X-CSRF-Token';

function normalizeOrigin(raw: string): string {
  let base = raw.trim().replace(/\/+$/, '');
  if (base.endsWith('/api/v1')) {
    base = base.slice(0, -'/api/v1'.length);
  }
  return base;
}

const API_ORIGIN = RAW_API_ORIGIN ? normalizeOrigin(RAW_API_ORIGIN) : '';
const API_V1_BASE_URL = USE_API_PROXY ? '/api/v1' : `${API_ORIGIN}/api/v1`;

function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (normalized.startsWith('/api/v1/')) {
    return normalized;
  }

  return `${API_V1_BASE_URL}${normalized}`;
}

function normalizeActionPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/api\/v1/, '');
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

async function safeJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
}

function unwrap<T>(payload: unknown): T {
  if (isRecord(payload) && 'data' in payload) {
    return payload.data as T;
  }

  return payload as T;
}

function normalizeArray<T>(value: unknown): T[] {
  const data = unwrap<unknown>(value);

  if (Array.isArray(data)) {
    return data as T[];
  }

  if (isRecord(data)) {
    const list = data.data ?? data.items ?? data.results ?? data.records ?? data.rows;

    if (Array.isArray(list)) {
      return list as T[];
    }
  }

  return [];
}

function messageFromPayload(payload: unknown, fallback: string): string {
  if (isRecord(payload)) {
    const message = payload.message ?? payload.error;

    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    if (isRecord(payload.data)) {
      const nestedMessage = payload.data.message ?? payload.data.error;

      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        return nestedMessage.trim();
      }
    }
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

function csrfPayloadFromEnvelope(payload: ApiEnvelope<JsonRecord> | JsonRecord): JsonRecord {
  if (isRecord(payload) && isRecord(payload.data)) {
    return payload.data;
  }

  if (isRecord(payload)) {
    return payload;
  }

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
    'X-CSRF-Token'
  );
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
    return {
      token: csrfTokenCache,
      header: csrfHeaderNameCache,
    };
  }

  const response = await fetch(apiUrl('/auth/csrf-token'), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await safeJson<ApiEnvelope<JsonRecord> | JsonRecord>(response);
  const data = csrfPayloadFromEnvelope(payload);

  const token = extractCsrfToken(data);
  const header = extractCsrfHeader(data);

  if (!token) {
    return null;
  }

  csrfTokenCache = token;
  csrfHeaderNameCache = header;

  return { token, header };
}

async function request<T>(path: string, options: RequestInit = {}, retryingAfterCsrfRefresh = false): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  headers.set('Accept', 'application/json');

  if (method !== 'GET' && method !== 'HEAD') {
    if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
    }

    const csrf = await requestCsrfToken(retryingAfterCsrfRefresh);

    if (csrf) {
      headers.set(csrf.header, csrf.token);
    }
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    method,
    credentials: 'include',
    cache: 'no-store',
    headers,
  });

  const payload = await safeJson<ApiEnvelope<T>>(response);

  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && !retryingAfterCsrfRefresh && method !== 'GET' && method !== 'HEAD') {
      csrfTokenCache = null;
      return request<T>(path, options, true);
    }

    if (response.status === 401 || response.status === 403) {
      csrfTokenCache = null;
    }

    throw new AdminWorkflowApiError(
      messageFromPayload(payload, `Request failed with status ${response.status}`),
      response.status,
      payload
    );
  }

  return unwrap<T>(payload);
}

export function requestTicketCode(request: ApprovalRequest): string {
  return String(request.ticketCode ?? request.ticket_code ?? request.id ?? '').trim();
}

export function requestEntityId(request: ApprovalRequest): string {
  return String(request.entityId ?? request.entity_id ?? '').trim();
}

export function requestEntityLabel(request: ApprovalRequest): string {
  return String(request.entityLabel ?? request.entity_label ?? requestTicketCode(request) ?? '').trim();
}

export function requestRequesterName(request: ApprovalRequest): string {
  return String(request.requestedByName ?? request.requested_by_name ?? '').trim();
}

export function requestRequesterEmail(request: ApprovalRequest): string {
  return String(request.requestedByEmail ?? request.requested_by_email ?? '').trim();
}

export function requestCreatedAt(request: ApprovalRequest): string {
  return String(request.createdAt ?? request.created_at ?? '').trim();
}

export function requestUpdatedAt(request: ApprovalRequest): string {
  return String(request.updatedAt ?? request.updated_at ?? '').trim();
}

export function requestApprovedAt(request: ApprovalRequest): string {
  return String(request.approvedAt ?? request.approved_at ?? '').trim();
}

export function requestApproverName(request: ApprovalRequest): string {
  return String(request.approvedByName ?? request.approved_by_name ?? '').trim();
}

export function requestApproverEmail(request: ApprovalRequest): string {
  return String(request.approvedByEmail ?? request.approved_by_email ?? '').trim();
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
    const cleanId = id.trim();

    if (!cleanId) {
      throw new AdminWorkflowApiError('Approval request id is required', 400);
    }

    return request<ApprovalRequestDetail>(`/admin/requests/${encodeURIComponent(cleanId)}`);
  },

  async getApprovalTimeline(days = 14): Promise<ApprovalRequestsTimeline> {
    return request<ApprovalRequestsTimeline>(`/admin/requests/timeline?days=${encodeURIComponent(String(days))}`);
  },

  async approveRequest(req: ApprovalRequest): Promise<unknown> {
    const entityId = requestEntityId(req);
    const action = req.actions?.approve;

    if (action) {
      return request(normalizeActionPath(action), {
        method: 'POST',
        body: '{}',
      });
    }

    switch (req.type) {
      case 'admin_user':
        if (!entityId) throw new AdminWorkflowApiError('Admin user id is missing from approval request', 400, req);
        return request(`/admin/users/${encodeURIComponent(entityId)}/approve`, { method: 'POST', body: '{}' });
      case 'event':
        if (!entityId) throw new AdminWorkflowApiError('Event id is missing from approval request', 400, req);
        return request(`/admin/events/${encodeURIComponent(entityId)}/approve`, { method: 'PATCH', body: '{}' });
      case 'testimonial':
        if (!entityId) throw new AdminWorkflowApiError('Testimonial id is missing from approval request', 400, req);
        return request(`/admin/testimonials/${encodeURIComponent(entityId)}/approve`, { method: 'PATCH', body: '{}' });
      case 'leadership_delete':
        if (!entityId) throw new AdminWorkflowApiError('Leadership id is missing from approval request', 400, req);
        return request(`/admin/leadership/${encodeURIComponent(entityId)}/delete/approve`, { method: 'POST', body: '{}' });
      case 'workforce_delete':
        if (!entityId) throw new AdminWorkflowApiError('Workforce id is missing from approval request', 400, req);
        return request(`/admin/workforce/${encodeURIComponent(entityId)}/delete/approve`, { method: 'POST', body: '{}' });
      case 'form_delete':
      case 'form_submission_delete':
        return request(`/admin/requests/${encodeURIComponent(req.id)}/approve`, { method: 'POST', body: '{}' });
      default:
        throw new AdminWorkflowApiError(`No approve action is configured for ${req.type}`, 400, req);
    }
  },

  async rejectRequest(req: ApprovalRequest, reason: string): Promise<unknown> {
    const entityId = requestEntityId(req);
    const body = JSON.stringify({ reason: reason.trim() || 'Request was not approved.' });
    const action = req.actions?.reject;

    if (action) {
      return request(normalizeActionPath(action), { method: 'POST', body });
    }

    switch (req.type) {
      case 'admin_user':
        if (!entityId) throw new AdminWorkflowApiError('Admin user id is missing from approval request', 400, req);
        return request(`/admin/users/${encodeURIComponent(entityId)}/reject`, { method: 'POST', body });
      case 'leadership_delete':
        if (!entityId) throw new AdminWorkflowApiError('Leadership id is missing from approval request', 400, req);
        return request(`/admin/leadership/${encodeURIComponent(entityId)}/decline`, { method: 'POST', body });
      case 'workforce_delete':
        if (!entityId) throw new AdminWorkflowApiError('Workforce id is missing from approval request', 400, req);
        return request(`/admin/workforce/${encodeURIComponent(entityId)}/decline`, { method: 'POST', body });
      default:
        return request(`/admin/requests/${encodeURIComponent(req.id)}/reject`, { method: 'POST', body });
    }
  },

  async deleteRequest(req: ApprovalRequest): Promise<unknown> {
    const action = req.actions?.delete;

    if (action) {
      return request(normalizeActionPath(action), { method: 'DELETE' });
    }

    return request(`/admin/requests/${encodeURIComponent(req.id)}`, { method: 'DELETE' });
  },

  async deleteFormSubmission(formId: string, submissionId: string): Promise<unknown> {
    const cleanFormId = formId.trim();
    const cleanSubmissionId = submissionId.trim();

    if (!cleanSubmissionId) {
      throw new AdminWorkflowApiError('Submission id is required', 400);
    }

    if (cleanFormId) {
      return request(`/admin/forms/${encodeURIComponent(cleanFormId)}/submissions/${encodeURIComponent(cleanSubmissionId)}`, { method: 'DELETE' });
    }

    return request(`/admin/forms/submissions/${encodeURIComponent(cleanSubmissionId)}`, { method: 'DELETE' });
  },
};
/* =========================
   CORE USER TYPES
========================= */

export type UserRole = 'admin' | 'super_admin';

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
  preferred_mfa_method?: MFAMethod;
  totp_enabled?: boolean;
  federated_provider?: string | null;
  federated_linked_at?: string;
}

/* =========================
   AUTH TYPES
========================= */

export type RegisterRole = UserRole;
export type MFAMethod = 'email_otp' | 'totp';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: RegisterRole;
  rememberMe?: boolean;
}

export interface LoginChallenge {
  otp_required: true;
  mfa_method?: MFAMethod;
  purpose: string;
  expires_at?: string;
  action_url?: string;
  email: string;
}

export type LoginResult =
  | { user: User; otp_required?: false }
  | LoginChallenge;

export interface AuthSecurityProfile {
  preferredMfaMethod: MFAMethod;
  totpEnabled: boolean;
  availableMethods: MFAMethod[];
  federatedProvider?: string | null;
  federatedLinkedAt?: string;
}

export interface TOTPSetupResponse {
  issuer: string;
  accountName: string;
  manualEntryKey: string;
  otpauthUrl: string;
}

export interface PasswordResetRequestPayload {
  email: string;
}

export interface PasswordResetConfirmPayload {
  email: string;
  code: string;
  purpose: string;
  newPassword: string;
  confirmPassword?: string;
}

/**
 * Generic API response wrapper (backend uses status/message/data).
 */
export interface ApiResponse<T = unknown> {
  status?: string;
  message: string;
  data?: T;
  error?: string;
  statusCode?: number;
}

/* =========================
   PAGINATION
========================= */

export interface PaginationMeta {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface PaginatedResponse<T> {
  status?: string;
  message?: string;
  data: T[];
  meta: PaginationMeta;
}

export interface SimplePaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* =========================
   EVENTS
========================= */

export type EventCategory =
  | 'Outreach'
  | 'Conference'
  | 'Workshop'
  | 'Prayer'
  | 'Revival'
  | 'Summit';

export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'happening' | 'past';

export interface EventSession {
  title: string;
  time: string;
}

export interface EventData {
  id: string;
  title: string;
  description: string;
  shortDescription: string;

  // Backward compatible: some events may only have `date`
  date: string;
  time: string;

  // Optional range (your UI expects these)
  startDate?: string;
  endDate?: string;

  registrationClosesAt?: string;
  sessions?: EventSession[];

  location: string;
  image?: string;
  bannerImage?: string;

  attendees: number;
  category: EventCategory;
  status: EventStatus;
  isFeatured: boolean;
  isApproved?: boolean;
  approvedById?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  tags: string[];

  registerLink?: string;
  speaker?: string;
  contactPhone?: string;

  createdAt: string;
  updatedAt: string;
}

export interface EventPayload {
  title: string;
  description: string;
  shortDescription: string;
  date: string;
  time: string;
  startDate?: string;
  endDate?: string;
  registrationClosesAt?: string;
  sessions?: Array<{ title: string; time: string }>;
  location: string;
  category: EventCategory;
  status: EventStatus;
  isFeatured: boolean;
  tags: string[];
  isApproved?: boolean;
  registerLink?: string;
  speaker?: string;
  contactPhone?: string;
  image?: string;
  bannerImage?: string;
  attendees?: number;
}

/* =========================
   REELS
========================= */

export interface ReelData {
  id: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  eventId?: string;
  duration: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReelData {
  title: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  eventId?: string;
}

/* =========================
   UPLOADS
========================= */

export interface UploadPresignRequest {
  filename?: string;
  contentType: string;
  size?: number;
  sizeBytes?: number;
  checksum?: string;
  ownerType?: string;
  ownerId?: string;
  kind?: string;
  folder?: string;
}

export interface UploadPresignResponse {
  assetId?: string;
  uploadUrl: string;
  publicUrl: string;
  objectKey?: string;
  key?: string;
  expiresAt?: string;
}

export interface UploadAssetData {
  id: string;
  publicUrl: string;
  objectKey: string;
  status: string;
  ownerType?: string | null;
  ownerId?: string | null;
  kind?: string | null;
  contentType?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UploadImageResponse {
  folder: string;
  key: string;
  url: string;
}

/* =========================
   EMAIL TEMPLATES
========================= */

export type EmailTemplateStatus = 'draft' | 'active' | 'archived';

export interface EmailTemplate {
  id: string;
  templateKey: string;
  ownerType?: string;
  ownerId?: string;
  subject?: string;
  htmlBody: string;
  textBody?: string;
  status: EmailTemplateStatus;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmailTemplateRequest {
  templateKey: string;
  ownerType?: string;
  ownerId?: string;
  subject?: string;
  htmlBody: string;
  textBody?: string;
  status?: EmailTemplateStatus;
  activate?: boolean;
}

export interface UpdateEmailTemplateRequest {
  templateKey?: string;
  ownerType?: string;
  ownerId?: string;
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  status?: EmailTemplateStatus;
  activate?: boolean;
}

/* =========================
   TESTIMONIALS
========================= */

export interface Testimonial {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  imageUrl?: string;
  testimony: string;
  isAnonymous: boolean;
  isApproved: boolean;
  approvedById?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTestimonialData {
  firstName: string;
  lastName: string;
  imageUrl?: string;
  testimony: string;
  isAnonymous: boolean;
}

export interface UpdateTestimonialData {
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  testimony?: string;
  isAnonymous?: boolean;
  isApproved?: boolean;
}

/* =========================
   DASHBOARD ANALYTICS
========================= */

export interface DashboardAnalytics {
  totalEvents: number;
  upcomingEvents: number;
  totalAttendees: number;
  eventsByCategory: Record<string, number>;
  monthlyStats: Array<{ month: string; events: number; attendees: number }>;
}

export interface SecurityOverview {
  generatedAt: string;
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  pendingAdminApprovals: number;
  pendingApprovalRequests: number;
  totpEnabledUsers: number;
  securityScore: number;
}

/* =========================
   SUBSCRIBERS + NOTIFICATIONS
========================= */

export type SubscriberStatus = 'active' | 'unsubscribed';

export interface Subscriber {
  id: string;
  email: string;
  name?: string;
  source?: string;
  status: SubscriberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscribeRequest {
  email: string;
  name?: string;
  source?: string;
}

export interface UnsubscribeRequest {
  email: string;
}

export type NotificationType = 'update' | 'event';

export interface Notification {
  id: string;
  type: NotificationType;
  subject: string;
  title: string;
  message: string;
  eventId?: string;
  createdAt: string;
}

export interface SendNotificationRequest {
  type: NotificationType;
  subject: string;
  title: string;
  message: string;
  eventId?: string;
}

export interface SendNotificationResult {
  notification?: Notification;
  total: number;
  sent: number;
  failed: number;
}

/* =========================
   OTP
========================= */

export interface SendOTPRequest {
  email: string;
  purpose?: string;
  actionUrl?: string;
  actionLabel?: string;
}

export interface VerifyOTPRequest {
  email: string;
  code: string;
  purpose?: string;
}

export interface SendOTPResponse {
  expiresAt: string;
  purpose?: string;
  actionUrl?: string;
}

export interface VerifyOTPResponse {
  verified: boolean;
}

/* =========================
   FORMS
========================= */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'number'
  | 'date'
  | 'image';

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldCondition {
  fieldKey: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  value?: unknown;
  values?: unknown[];
}

export interface FormFieldVisibility {
  match?: 'all' | 'any';
  rules?: FormFieldCondition[];
}

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  maxWords?: number;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface FormField {
  id: string;
  formId?: string;
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[];
  validation?: FormFieldValidation;
  visibility?: FormFieldVisibility;
  order: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormDesignSettings {
  heroTitle?: string;
  heroSubtitle?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  backgroundColor?: string;
  accentColor?: string;
  layout?: 'split' | 'stacked' | 'inline';
  ctaButtonLabel?: string;
  privacyCopy?: string;
  footerNote?: string;
}

export interface FormContentSection {
  title?: string;
  subtitle?: string;
  items?: string[];
  itemSubtexts?: string[];
}

export interface FormSettings {
  capacity?: number;
  closesAt?: string;
  expiresAt?: string;
  successTitle?: string;
  successSubtitle?: string;
  successMessage?: string;
  formType?: 'registration' | 'event' | 'membership' | 'workforce' | 'leadership' | 'application' | 'contact' | 'general';
  responseEmailEnabled?: boolean;
  responseEmailTemplateId?: string;
  responseEmailTemplateKey?: string;
  responseEmailTemplateUrl?: string;
  responseEmailSubject?: string;
  campaignEmailEnabled?: boolean;
  campaignEmailTemplateId?: string;
  campaignEmailTemplateKey?: string;
  campaignEmailTemplateUrl?: string;
  campaignEmailSubject?: string;
  submissionTarget?: 'workforce' | 'workforce_new' | 'workforce_serving' | 'member' | 'leadership' | 'testimonial';
  submissionDepartment?: string;

  // UI extras you added:
  introTitle?: string;
  introSubtitle?: string;
  introBullets?: string[];
  introBulletSubtexts?: string[];
  contentSections?: FormContentSection[];
  layoutMode?: 'split' | 'stack';
  dateFormat?: 'yyyy-mm-dd' | 'mm/dd/yyyy' | 'dd/mm/yyyy' | 'dd/mm';
  footerText?: string;
  footerBg?: string;
  footerTextColor?: string;
  submitButtonText?: string;
  submitButtonBg?: string;
  submitButtonTextColor?: string;
  submitButtonIcon?: 'check' | 'send' | 'calendar' | 'cursor' | 'none';
  formHeaderNote?: string;

  design?: FormDesignSettings;
}

export type FormStatus = 'draft' | 'published' | 'invalid';

export interface AdminForm {
  id: string;
  title: string;
  description?: string;
  eventId?: string;
  slug?: string;
  publicUrl?: string;
  isPublished: boolean;
  status?: FormStatus;
  publishedAt?: string;
  settings?: FormSettings;
  fields: FormField[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicFormPayload {
  form: AdminForm;
  event?: EventData;
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  slug?: string;
  eventId?: string;
  settings?: FormSettings;
  fields: Array<Omit<FormField, 'id' | 'formId' | 'createdAt' | 'updatedAt'>>;
}

export type UpdateFormRequest = Partial<CreateFormRequest>;

export interface SubmitFormRequest {
  values: Record<string, string | boolean | number | string[] | File | null>;
}

export interface FormSubmission {
  id: string;
  formId: string;
  name?: string;
  email?: string;
  contactNumber?: string;
  contactAddress?: string;
  registrationCode?: string;
  values: Record<string, string | boolean | number | string[] | null>;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmissionCount {
  formId: string;
  formTitle: string;
  count: number;
}

export interface FormSubmissionDailyStat {
  date: string;
  count: number;
}

export interface FormSubmissionWithForm {
  id: string;
  formId: string;
  formTitle: string;
  name?: string;
  email?: string;
  contactNumber?: string;
  contactAddress?: string;
  registrationCode?: string;
  values: Record<string, string | boolean | number | string[] | null>;
  createdAt: string;
}

export interface FormStatsResponse {
  totalSubmissions: number;
  perForm: FormSubmissionCount[];
  recent: FormSubmissionWithForm[];
}

export interface FormReportLinkPayload {
  formId: string;
  formTitle: string;
  slug: string;
  reportUrl: string;
  reportDataUrl: string;
  exportPdfUrl: string;
}

export interface AdminEmailAudienceFormSummary {
  formId: string;
  formTitle: string;
  totalSubmissions: number;
  validRecipients: number;
  uniqueRecipients: number;
}

export interface AdminEmailMarketingFormItem {
  formId: string;
  formTitle: string;
  status: string;
  isPublished: boolean;
  publicUrl?: string;
  publishedAt?: string;
  updatedAt: string;
  lastSubmissionAt?: string;
  totalSubmissions: number;
  validRecipients: number;
  uniqueRecipients: number;
}

export interface AdminEmailMarketingSummary {
  totalForms: number;
  publishedForms: number;
  draftForms: number;
  totalSubmissions: number;
  reachableRecipients: number;
  totalCampaigns: number;
  topForms?: AdminEmailMarketingFormItem[];
  recentCampaigns?: AdminEmailDeliveryHistoryItem[];
}

export interface AdminEmailAudienceRecipientSource {
  formId: string;
  formTitle: string;
}

export interface AdminEmailAudiencePreviewRecipient {
  email: string;
  name?: string;
  sourceForms?: AdminEmailAudienceRecipientSource[];
}

export interface AdminEmailAudiencePreview {
  forms: AdminEmailMarketingFormItem[];
  totalForms: number;
  totalSubmissions: number;
  validRecipients: number;
  uniqueRecipients: number;
  skipped: number;
  previewCount: number;
  recipients: AdminEmailAudiencePreviewRecipient[];
}

export interface AdminEmailRecipientInput {
  name?: string;
  email: string;
}

export interface SendAdminComposeEmailRequest {
  subject?: string;
  htmlBody?: string;
  textBody?: string;
  templateId?: string;
  templateKey?: string;
  manualRecipients?: AdminEmailRecipientInput[];
  formIds?: string[];
}

export interface SendAdminComposeEmailResponse {
  deliveryId?: string;
  subject: string;
  templateSource: string;
  audienceSource: string;
  manualRecipients: number;
  formRecipients: number;
  sourceForms?: AdminEmailAudienceFormSummary[];
  totalRecipients: number;
  targeted: number;
  sent: number;
  skipped: number;
  failed: number;
  failedRecipients?: string[];
  startedAt: string;
  completedAt: string;
  sentAt: string;
}

export interface AdminEmailDeliveryHistoryItem {
  id: string;
  subject: string;
  templateSource: string;
  templateId?: string;
  templateKey?: string;
  audienceSource: string;
  manualRecipients: number;
  formRecipients: number;
  sourceForms?: AdminEmailAudienceFormSummary[];
  status: string;
  totalRecipients: number;
  targeted: number;
  sent: number;
  skipped: number;
  failed: number;
  failedRecipients?: string[];
  startedAt: string;
  completedAt?: string;
  createdByUserId?: string;
  createdByEmail?: string;
  createdByRole?: string;
  createdAt: string;
  updatedAt: string;
}

/* =========================
   SITE CONTENT + ENGAGEMENT
========================= */

export interface HomepageAdContent {
  id: string;
  title: string;
  headline: string;
  description: string;
  startAt: string;
  endAt: string;
  time: string;
  location: string;
  image: string;
  registerUrl: string;
  ctaLabel: string;
  note: string;
}

export interface ConfessionPopupContent {
  welcomeTitle: string;
  welcomeMessage: string;
  confessionText: string;
  motto: string;
}

export interface PastoralCareRequestAdmin {
  id: string;
  title: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  eventDate: string;
  eventType: string;
  churchRole: string;
  customRole?: string;
  comments?: string;
  sourceChannel: string;
  createdAt: string;
  updatedAt: string;
}

export interface GivingIntentAdmin {
  id: string;
  title: string;
  description?: string;
  sourceChannel: string;
  createdAt: string;
  updatedAt: string;
}

/* =========================
   WORKFORCE
========================= */

/**
 * IMPORTANT: your backend flow implies "pending" exists (public apply defaults to pending)
 */
export type WorkforceStatus = 'pending' | 'new' | 'serving' | 'not_serving';

export interface WorkforceMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;
  sourceChannel?: string;
  status: WorkforceStatus;
  notes?: string;
  birthdayMonth?: number;
  birthdayDay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkforceRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;

  /**
   * Optional for admin-created records; public apply defaults to pending.
   */
  status?: Extract<WorkforceStatus, 'pending' | 'new'>;

  notes?: string;
}

export interface UpdateWorkforceRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  department?: string;
  status?: WorkforceStatus;
  notes?: string;
  birthdayMonth?: number;
  birthdayDay?: number;
  birthday?: string;
}

/* =========================
   MEMBERS
========================= */

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  birthdayMonth?: number;
  birthdayDay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  isActive?: boolean;
  birthdayMonth?: number;
  birthdayDay?: number;
  birthday?: string;
}

export interface UpdateMemberRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  birthdayMonth?: number;
  birthdayDay?: number;
  birthday?: string;
}

export interface WorkforceBucket {
  department: string;
  status: WorkforceStatus;
  count: number;
}

export interface WorkforceStatsResponse {
  total: number;
  byStatus: Record<string, number>;
  byDepartment: Record<string, number>;
  bySource?: Record<string, number>;
  frontendByDepartment?: Record<string, number>;
  byDeptAndStatus: WorkforceBucket[];
}

/* =========================
   LEADERSHIP
========================= */

export type LeadershipRole =
  | 'senior_pastor'
  | 'associate_pastor'
  | 'deacon'
  | 'deaconess'
  | 'reverend';

export type LeadershipStatus = 'pending' | 'approved' | 'declined';

export interface LeadershipMember {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: LeadershipRole;
  status: LeadershipStatus;
  bio?: string | null;
  imageUrl?: string | null;
  birthdayMonth?: number;
  birthdayDay?: number;
  anniversaryMonth?: number;
  anniversaryDay?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadershipRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: LeadershipRole;
  status?: LeadershipStatus;
  bio?: string;
  imageUrl?: string;
  birthday?: string;
  anniversary?: string;
}

export interface UpdateLeadershipRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: LeadershipRole;
  status?: LeadershipStatus;
  bio?: string;
  imageUrl?: string;
  birthday?: string;
  anniversary?: string;
}

/* =========================
   ADMIN NOTIFICATIONS
========================= */

export interface AdminNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  ticketCode?: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface AdminNotificationInbox {
  items: AdminNotification[];
  unread: number;
}

/* =========================
   APPROVAL REQUESTS
========================= */

export type ApprovalRequestType = 'testimonial' | 'event' | 'admin_user';
export type ApprovalRequestStatus = 'pending' | 'approved' | 'deleted';

export interface ApprovalRequest {
  id: string;
  ticketCode: string;
  type: ApprovalRequestType;
  status: ApprovalRequestStatus;
  entityId?: string;
  entityLabel?: string;
  requestedById?: string;
  requestedByName?: string;
  requestedByEmail?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalTimelinePoint {
  day: string;
  count: number;
}

export interface ApprovalRequestsTimeline {
  start: string;
  end: string;
  created: ApprovalTimelinePoint[];
  approved: ApprovalTimelinePoint[];
}

/* =========================
   STORE
========================= */

export type StoreOrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface StoreProductAdmin {
  id: number;
  name: string;
  category: string;
  price: string;
  originalPrice?: string | null;
  image: string;
  description: string;
  sizes: string[];
  colors: string[];
  tags: string[];
  stock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertStoreProductRequest {
  name: string;
  category: string;
  price: string;
  originalPrice?: string;
  image: string;
  description: string;
  sizes: string[];
  colors: string[];
  tags: string[];
  stock: number;
  isActive?: boolean;
}

export interface StoreOrderItemAdmin {
  id: string;
  productId?: number;
  name: string;
  price: string;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StoreOrderAdmin {
  orderId: string;
  orderDate: string;
  status: StoreOrderStatus;
  paymentMethod: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: StoreOrderItemAdmin[];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };
  bankDetails?: {
    customerAccountName?: string | null;
    customerBankName?: string | null;
  };
}

export interface StoreOrdersPaginated {
  data: StoreOrderAdmin[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* =========================
   MISC
========================= */

export interface MessageResponse {
  status?: string;
  message: string;
  data?: unknown;
  success?: boolean;
  statusCode?: number;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
  email?: string;
  otpCode?: string;
}

/**
 * FIXED: backend returns timestamp as Unix number (seconds) on /health
 */
export interface HealthCheckResponse {
  status: string;
  service: string;
  version: string;
  timestamp: number; // unix seconds
  uptime: string;
  database?: string;
}

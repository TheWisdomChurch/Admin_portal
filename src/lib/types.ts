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
}

/* =========================
   AUTH TYPES
========================= */

export type RegisterRole = UserRole;

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
  purpose: string;
  expires_at?: string;
  action_url?: string;
  email: string;
}

export type LoginResult =
  | { user: User; otp_required?: false }
  | LoginChallenge;

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

export type EventStatus = 'upcoming' | 'happening' | 'past';

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

export interface FormField {
  id: string;
  formId?: string;
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: FormFieldOption[];
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

export interface FormSettings {
  capacity?: number;
  closesAt?: string;
  expiresAt?: string;
  successTitle?: string;
  successSubtitle?: string;
  successMessage?: string;
  responseEmailEnabled?: boolean;
  responseEmailTemplateId?: string;
  responseEmailTemplateKey?: string;
  responseEmailSubject?: string;
  submissionTarget?: 'workforce' | 'workforce_new' | 'workforce_serving' | 'member';
  submissionDepartment?: string;

  // UI extras you added:
  introTitle?: string;
  introSubtitle?: string;
  introBullets?: string[];
  introBulletSubtexts?: string[];
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

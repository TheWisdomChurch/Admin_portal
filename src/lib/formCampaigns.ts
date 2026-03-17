import { apiFetch } from './api';
import type { FormEmailResourceLink } from './formEmailTemplates';

export type FormCampaignCTA = {
  label: string;
  url: string;
};

export type FormCampaignHighlight = {
  label: string;
  value: string;
};

export type SendFormCampaignRequest = {
  subject?: string;
  title?: string;
  previewText?: string;
  heroEyebrow?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  htmlBody?: string;
  textBody?: string;
  introHtml?: string;
  bodyHtml?: string;
  closingHtml?: string;
  heroImageUrl?: string;
  flyerImageUrls?: string[];
  primaryCta?: FormCampaignCTA;
  secondaryCta?: FormCampaignCTA;
  highlights?: FormCampaignHighlight[];
  footerNote?: string;
  resourceLinks?: FormEmailResourceLink[];
  targetSubmissionIds?: string[];
  includeCalendarLinks?: boolean;
  templateId?: string;
  templateKey?: string;
};

export type SendFormCampaignResult = {
  formId: string;
  formTitle: string;
  eventTitle?: string;
  subject: string;
  templateSource: string;
  failureReason?: string;
  failedRecipientDetails?: Array<{
    email: string;
    error: string;
  }>;
  totalRecipients: number;
  targeted: number;
  sent: number;
  skipped: number;
  failed: number;
  failedRecipients: string[];
  startedAt: string;
  completedAt: string;
  sentAt: string;
};

export async function sendFormCampaign(
  formId: string,
  payload: SendFormCampaignRequest
): Promise<SendFormCampaignResult> {
  const body = await apiFetch<
    { data?: SendFormCampaignResult; message?: string; error?: string } | SendFormCampaignResult
  >(`/admin/forms/${encodeURIComponent(formId)}/campaigns/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (body && 'data' in body && body.data) {
    return body.data;
  }

  return body as SendFormCampaignResult;
}

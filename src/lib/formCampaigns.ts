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
  const response = await fetch(`/api/v1/admin/forms/${encodeURIComponent(formId)}/campaigns/send`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as
    | { data?: SendFormCampaignResult; message?: string; error?: string }
    | SendFormCampaignResult
    | null;

  if (!response.ok) {
    const message =
      (body && 'message' in body && typeof body.message === 'string' && body.message.trim()) ||
      (body && 'error' in body && typeof body.error === 'string' && body.error.trim()) ||
      'Failed to send form campaign.';
    throw new Error(message);
  }

  if (body && 'data' in body && body.data) {
    return body.data;
  }

  return body as SendFormCampaignResult;
}

import type { FormEmailCalendarEvent } from './formEmailTemplates';

export type SendFormCampaignRequest = {
  subject: string;
  title: string;
  htmlBody: string;
  textBody: string;
  calendarUrl?: string;
  calendarEvent?: FormEmailCalendarEvent;
};

export type SendFormCampaignResult = {
  formId: string;
  subject: string;
  totalRecipients: number;
  sent: number;
  failed: number;
  failedRecipients: string[];
  startedAt: string;
  completedAt: string;
};

type FormCampaignResponse = {
  data?: SendFormCampaignResult;
  message?: string;
  error?: string;
};

export async function sendFormCampaign(
  formId: string,
  payload: SendFormCampaignRequest
): Promise<SendFormCampaignResult> {
  const response = await fetch(`/api/admin/forms/${encodeURIComponent(formId)}/campaigns/send`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as FormCampaignResponse | SendFormCampaignResult | null;

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

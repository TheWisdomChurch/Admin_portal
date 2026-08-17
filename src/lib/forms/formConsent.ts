import type { FormConsentSettings } from '@/lib/types';

export const DEFAULT_FORM_CONSENT: Required<FormConsentSettings> = {
  enabled: true,
  required: true,
  title: 'Consent, privacy and responsible use of your information',
  introduction:
    'The Wisdom Church collects the information you provide so that we can administer this request or registration, communicate with you, provide appropriate pastoral or operational support, and maintain accurate church records. Please read this notice before submitting the form.',
  purposes: [
    'Process and manage this registration, application, request, or ministry activity.',
    'Contact you about this submission, relevant updates, and any action you requested.',
    'Maintain accurate attendance, membership, pastoral-care, safeguarding, and operational records where applicable.',
    'Improve church services through proportionate, aggregated reporting and planning.',
  ],
  dataUse:
    'Access is limited to authorised church staff and ministry leaders who need the information for the purposes described above. We do not sell personal information. We only disclose it to approved service providers, professional advisers, safeguarding authorities, or public bodies when necessary, appropriately protected, or required by law.',
  retention:
    'Information is retained only for as long as it is reasonably needed for the stated purpose, church administration, safeguarding, dispute resolution, and applicable legal or financial obligations. It is then securely deleted, anonymised, or archived under the church retention policy.',
  rights:
    'You may ask to access or correct your information and, where applicable, request deletion, restriction, or withdrawal of consent. Withdrawing consent does not affect processing already completed and may limit our ability to provide a requested service where the information is necessary to do so.',
  contact:
    'To ask a privacy question, correct your details, or exercise a data-protection right, contact the church administration team using the official contact details published by The Wisdom Church. We may verify your identity before acting on a request to protect your information.',
  acknowledgementLabel:
    'I confirm that I have read and understood this privacy notice, that the information I provided is accurate to the best of my knowledge, and that I consent to its use for the purposes described above.',
  version: process.env.NEXT_PUBLIC_PRIVACY_NOTICE_VERSION?.trim() || '2026.1',
};

export function getEffectiveFormConsent(consent?: FormConsentSettings): Required<FormConsentSettings> {
  return {
    ...DEFAULT_FORM_CONSENT,
    ...consent,
    enabled: true,
    required: true,
    purposes: consent?.purposes?.filter((purpose) => purpose.trim()) || DEFAULT_FORM_CONSENT.purposes,
  };
}

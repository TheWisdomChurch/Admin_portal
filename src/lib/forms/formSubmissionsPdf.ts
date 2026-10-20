import type { FormSubmission } from '../types';
import type { ExportFormField, FormSubmissionFilters } from './formSubmissions';
import {
  buildFieldLabelMap,
  buildFilename,
  buildFilterSummary,
  buildOrderedValueKeys,
  buildSubmissionResponseEntries,
  formatDateTime,
  isLikelyImageUrl,
  resolveExportFieldLabel,
  resolveFormSubmissionEmail,
  resolveFormSubmissionName,
  resolveSubmissionMediaUrl,
  serializeSubmissionValue,
  sortFormSubmissionsByCreatedAt,
} from './formSubmissions';

// Visual design tokens
const COLOR_PRIMARY: [number, number, number] = [15, 23, 42]; // #0F172A
const COLOR_GOLD: [number, number, number] = [217, 119, 6]; // #D97706
const COLOR_GOLD_LIGHT: [number, number, number] = [254, 243, 199]; // #FEF3C7
const COLOR_GOLD_TEXT: [number, number, number] = [146, 64, 14]; // #92400E
const COLOR_MUTED: [number, number, number] = [100, 116, 139]; // #64748B
const COLOR_SECONDARY: [number, number, number] = [51, 65, 85]; // #334155
const COLOR_BORDER: [number, number, number] = [226, 232, 240]; // #E2E8F0
const COLOR_ZEBRA: [number, number, number] = [248, 250, 252]; // #F8FAFC
const COLOR_WHITE: [number, number, number] = [255, 255, 255];

export interface StructuredSubmissionsPdfOptions {
  formTitle?: string;
  formSlug?: string;
  formId?: string;
  fields?: ExportFormField[];
  filters?: FormSubmissionFilters;
  fileLabel?: string;
}

/**
 * Generates an executive-grade, beautifully structured multi-page PDF dossier
 * of form submissions with executive metrics, church branding, clean tabular cards,
 * and clear page headers/footers.
 */
export async function exportStructuredSubmissionsPdf(
  submissions: FormSubmission[],
  options: StructuredSubmissionsPdfOptions = {}
): Promise<void> {
  const orderedSubmissions = sortFormSubmissionsByCreatedAt(submissions);
  if (orderedSubmissions.length === 0) {
    throw new Error('No submissions to export');
  }

  const { jsPDF } = await import('jspdf');
  // Dimensions in millimeters for crisp standard A4 layout
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const printableWidth = pageWidth - margin * 2;
  const footerMargin = 12;

  const formTitle = options.formTitle?.trim() || 'Form Submissions';
  const orderedValueKeys = buildOrderedValueKeys(orderedSubmissions, options.fields);
  const fieldLabelMap = buildFieldLabelMap(options.fields);

  let currentY = 0;

  const drawRunningHeader = (pageNumber: number) => {
    if (pageNumber === 1) return; // Cover has dedicated banner
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('THE WISDOM CHURCH · REGISTRY REPORT', margin, 9);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(formTitle, 80)[0], pageWidth - margin, 9, { align: 'right' });
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, 11, pageWidth - margin, 11);
  };

  const drawRunningFooter = (pageNumber: number, totalPages: number) => {
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - footerMargin - 2, pageWidth - margin, pageHeight - footerMargin - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('CONFIDENTIAL · FOR INTERNAL ADMINISTRATIVE USE ONLY', margin, pageHeight - footerMargin + 2);
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - footerMargin + 2, {
      align: 'right',
    });
  };

  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - footerMargin - 4) {
      doc.addPage();
      currentY = 16;
      drawRunningHeader(doc.getNumberOfPages());
    }
  };

  // --- PAGE 1: EXECUTIVE COVER & SUMMARY BANNER ---
  // Top brand stripe
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // Executive dark banner
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 3.5, pageWidth, 38, 'F');

  // Brand Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...COLOR_WHITE);
  doc.text('THE WISDOM CHURCH', margin, 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD);
  doc.text('ADMINISTRATIVE INTAKE & SUBMISSIONS DOSSIER', margin, 20);

  // Form Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...COLOR_WHITE);
  const truncatedTitle = doc.splitTextToSize(formTitle, printableWidth - 60)[0];
  doc.text(truncatedTitle, margin, 29);

  // Right-side metadata
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Export Date (UTC):', pageWidth - margin, 14, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_WHITE);
  doc.text(formatDateTime(new Date().toISOString()), pageWidth - margin, 19, { align: 'right' });
  if (options.formSlug) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Slug: /forms/${options.formSlug}`, pageWidth - margin, 25, { align: 'right' });
  }

  currentY = 46;

  // --- EXECUTIVE SUMMARY METRIC CARDS ---
  const totalCount = orderedSubmissions.length;
  const withCodes = orderedSubmissions.filter((s) => Boolean(s.registrationCode?.trim())).length;
  const withEmails = orderedSubmissions.filter((s) => Boolean(resolveFormSubmissionEmail(s)?.trim())).length;
  const withMedia = orderedSubmissions.filter((s) => {
    const vals = s.values || {};
    return Object.values(vals).some((v) => {
      const url = resolveSubmissionMediaUrl(v);
      return url != null && isLikelyImageUrl(url);
    });
  }).length;

  const cardW = (printableWidth - 9) / 4;
  const cardH = 18;

  const kpis: Array<{ label: string; value: string; desc: string }> = [
    { label: 'TOTAL SUBMISSIONS', value: String(totalCount), desc: 'Recorded entries' },
    { label: 'CHECK-IN PASSCODES', value: String(withCodes), desc: `${Math.round((withCodes / (totalCount || 1)) * 100)}% verified codes` },
    { label: 'CONTACT REACH', value: String(withEmails), desc: `${Math.round((withEmails / (totalCount || 1)) * 100)}% with valid email` },
    { label: 'MEDIA & UPLOADS', value: String(withMedia), desc: `${withMedia} attachments` },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardW + 3);
    doc.setFillColor(...COLOR_ZEBRA);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(cardX, currentY, cardW, cardH, 2, 2, 'FD');

    // Accent line on top of card
    doc.setFillColor(...COLOR_GOLD);
    doc.roundedRect(cardX, currentY, cardW, 1, 0.5, 0.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(kpi.label, cardX + 3.5, currentY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(kpi.value, cardX + 3.5, currentY + 11.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(kpi.desc, cardX + 3.5, currentY + 15.5);
  });

  currentY += cardH + 6;

  // Active Filters note
  const filterSummary = buildFilterSummary(options.filters);
  if (filterSummary.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text('Applied Filters: ', margin, currentY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_SECONDARY);
    doc.text(filterSummary.join(' · '), margin + 22, currentY);
    currentY += 5;
  }

  // --- SUBMISSIONS SECTION HEADER ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('SUBMISSION RECORDS', margin, currentY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(`Showing ${totalCount} comprehensive registration dossier${totalCount === 1 ? '' : 's'}`, margin + 50, currentY);

  currentY += 3;
  doc.setDrawColor(...COLOR_PRIMARY);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, margin + 25, currentY);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.line(margin + 25, currentY, pageWidth - margin, currentY);
  currentY += 5;

  // --- SUBMISSION CARDS LOOP ---
  for (let idx = 0; idx < orderedSubmissions.length; idx += 1) {
    const submission = orderedSubmissions[idx];
    const name = resolveFormSubmissionName(submission, 'Anonymous');
    const email = resolveFormSubmissionEmail(submission);
    const phone = submission.contactNumber?.trim() || '';
    const address = submission.contactAddress?.trim() || '';
    const code = submission.registrationCode?.trim() || '';
    const submittedDate = formatDateTime(submission.createdAt);
    const responseEntries = buildSubmissionResponseEntries(submission, orderedValueKeys);

    // Estimate block height
    const baseHeight = 22; // header bar + contact row
    const linesOfResponses = Math.ceil(responseEntries.length / 2);
    const estimatedHeight = Math.max(30, baseHeight + linesOfResponses * 9 + 4);

    ensureSpace(estimatedHeight);

    const cardTop = currentY;

    // Card container outline
    doc.setFillColor(...COLOR_WHITE);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);

    // Card Header Bar
    doc.setFillColor(...COLOR_ZEBRA);
    doc.roundedRect(margin, cardTop, printableWidth, 7.5, 1.5, 1.5, 'FD');

    // Index & Name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(`#${idx + 1}   ${name}`, margin + 3.5, cardTop + 5);

    // Registration Code Pill
    if (code) {
      const pillW = 34;
      const pillX = pageWidth - margin - pillW - 2;
      doc.setFillColor(...COLOR_GOLD_LIGHT);
      doc.roundedRect(pillX, cardTop + 1.2, pillW, 5.2, 1, 1, 'F');
      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_GOLD_TEXT);
      doc.text(code, pillX + pillW / 2, cardTop + 4.8, { align: 'center' });
    }

    currentY = cardTop + 10.5;

    // Contact Information line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('CONTACT:', margin + 3.5, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SECONDARY);
    const contactParts = [
      email ? `Email: ${email}` : null,
      phone ? `Phone: ${phone}` : null,
      address ? `Address: ${address}` : null,
      `Submitted: ${submittedDate}`,
    ].filter(Boolean);
    doc.text(contactParts.join('   |   '), margin + 20, currentY);

    currentY += 4.5;
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.15);
    doc.line(margin + 3.5, currentY, pageWidth - margin - 3.5, currentY);
    currentY += 3;

    // Responses Grid
    if (responseEntries.length > 0) {
      const colW = (printableWidth - 10) / 2;

      for (let rIdx = 0; rIdx < responseEntries.length; rIdx += 2) {
        ensureSpace(10);
        const itemLeft = responseEntries[rIdx];
        const itemRight = responseEntries[rIdx + 1];

        // Left Item
        if (itemLeft) {
          const [key, val] = itemLeft;
          const label = resolveExportFieldLabel(key, fieldLabelMap);
          const valStr = serializeSubmissionValue(val) || '—';

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(...COLOR_MUTED);
          doc.text(label.toUpperCase(), margin + 3.5, currentY);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...COLOR_PRIMARY);
          const valLines = doc.splitTextToSize(valStr, colW - 5);
          doc.text(valLines[0] || '—', margin + 3.5, currentY + 3.6);
        }

        // Right Item
        if (itemRight) {
          const [key, val] = itemRight;
          const label = resolveExportFieldLabel(key, fieldLabelMap);
          const valStr = serializeSubmissionValue(val) || '—';

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.8);
          doc.setTextColor(...COLOR_MUTED);
          doc.text(label.toUpperCase(), margin + 3.5 + colW + 4, currentY);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...COLOR_PRIMARY);
          const valLines = doc.splitTextToSize(valStr, colW - 5);
          doc.text(valLines[0] || '—', margin + 3.5 + colW + 4, currentY + 3.6);
        }

        currentY += 8;
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_MUTED);
      doc.text('No additional questionnaire fields submitted.', margin + 3.5, currentY);
      currentY += 5;
    }

    // Outer card border
    const cardHeight = currentY - cardTop + 2;
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, cardTop, printableWidth, cardHeight, 1.5, 1.5, 'D');

    currentY += 5;
  }

  // Add running footers and headers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    doc.setPage(p);
    drawRunningHeader(p);
    drawRunningFooter(p, totalPages);
  }

  const filename = `${buildFilename('form-submissions', options.fileLabel || formTitle)}.pdf`;
  doc.save(filename);
}

/**
 * Generates an official, single-page A4 registration receipt / verification certificate
 * for an individual attendee/member submission.
 */
export interface SingleSubmissionReceiptOptions {
  formTitle?: string;
  formSlug?: string;
  formId?: string;
  fields?: ExportFormField[];
}

export async function exportSingleSubmissionReceiptPdf(
  submission: FormSubmission,
  options: SingleSubmissionReceiptOptions = {}
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const printableWidth = pageWidth - margin * 2;

  const formTitle = options.formTitle?.trim() || 'Church Program Registration';
  const name = resolveFormSubmissionName(submission, 'Anonymous');
  const email = resolveFormSubmissionEmail(submission) || '—';
  const phone = submission.contactNumber?.trim() || '—';
  const address = submission.contactAddress?.trim() || '—';
  const code = submission.registrationCode?.trim() || 'RECORDED';
  const submittedAt = formatDateTime(submission.createdAt);

  const fieldLabelMap = buildFieldLabelMap(options.fields);
  const orderedKeys = buildOrderedValueKeys([submission], options.fields);
  const responseEntries = buildSubmissionResponseEntries(submission, orderedKeys);

  // Top Accent Stripe
  doc.setFillColor(...COLOR_GOLD);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Header Letterhead Band
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 4, pageWidth, 32, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_WHITE);
  doc.text('THE WISDOM CHURCH', margin, 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD);
  doc.text('OFFICIAL REGISTRATION RECEIPT & SUBMISSION CERTIFICATE', margin, 21);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Issued ${formatDateTime(new Date().toISOString())}`, pageWidth - margin, 16, { align: 'right' });
  doc.text('Administrative Registry Records', pageWidth - margin, 21, { align: 'right' });

  let y = 43;

  // Program Banner
  doc.setFillColor(...COLOR_ZEBRA);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, printableWidth, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('PROGRAM / EVENT TITLE', margin + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(doc.splitTextToSize(formTitle, printableWidth - 8)[0], margin + 4, y + 11.5);

  y += 21;

  // Passcode / Registration Code Callout Box
  doc.setFillColor(...COLOR_GOLD_LIGHT);
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, printableWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD_TEXT);
  doc.text('OFFICIAL REGISTRATION PASSCODE / CHECK-IN ID', margin + 5, y + 6);

  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(code, margin + 5, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_GOLD_TEXT);
  doc.text('Please present this code or document on arrival for instant check-in.', margin + 5, y + 20);

  y += 30;

  // Registrant Identity Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('REGISTRANT INFORMATION', margin, y);
  y += 3;
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  const metaRows: Array<[string, string]> = [
    ['Full Name', name],
    ['Email Address', email],
    ['Phone Number', phone],
    ['Physical / Contact Address', address],
    ['Date & Time Submitted', submittedAt],
  ];

  metaRows.forEach(([lbl, val], idx) => {
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(...COLOR_ZEBRA);
      doc.rect(margin, y, printableWidth, 6.5, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(lbl, margin + 3, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_PRIMARY);
    doc.text(val, margin + 55, y + 4.5);
    y += 6.5;
  });

  y += 6;

  // Questionnaire Responses Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('QUESTIONNAIRE RESPONSES', margin, y);
  y += 3;
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  if (responseEntries.length > 0) {
    // Table Header
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(margin, y, printableWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_WHITE);
    doc.text('QUESTION / PROMPT', margin + 3, y + 4.5);
    doc.text('SUBMITTED ANSWER', margin + 70, y + 4.5);
    y += 6.5;

    responseEntries.forEach(([k, v], rIdx) => {
      const qLabel = resolveExportFieldLabel(k, fieldLabelMap);
      const answer = serializeSubmissionValue(v) || '—';
      const isEven = rIdx % 2 === 0;

      const answerLines = doc.splitTextToSize(answer, printableWidth - 75);
      const rowHeight = Math.max(6.5, answerLines.length * 4 + 2);

      if (isEven) {
        doc.setFillColor(...COLOR_ZEBRA);
        doc.rect(margin, y, printableWidth, rowHeight, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(...COLOR_SECONDARY);
      const qLines = doc.splitTextToSize(qLabel, 64);
      doc.text(qLines, margin + 3, y + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...COLOR_PRIMARY);
      doc.text(answerLines, margin + 70, y + 4);

      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.15);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

      y += rowHeight;
    });
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('No additional questionnaire responses were submitted for this registration.', margin + 3, y + 5);
    y += 10;
  }

  // Official Signature & Seal Block at Bottom
  const bottomY = pageHeight - 34;
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.line(margin, bottomY, pageWidth - margin, bottomY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('WISDOM CHURCH ADMINISTRATIVE REGISTRY', margin, bottomY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_MUTED);
  doc.text('Verified digital record · Generated automatically upon registration submission.', margin, bottomY + 10);
  doc.text('For questions or support, contact: wisdomchurch21@gmail.com', margin, bottomY + 14);

  // Status stamp box
  doc.setFillColor(...COLOR_GOLD_LIGHT);
  doc.setDrawColor(...COLOR_GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - margin - 42, bottomY + 3, 42, 14, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLOR_GOLD_TEXT);
  doc.text('STATUS: CONFIRMED', pageWidth - margin - 21, bottomY + 8.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Official Church Seal', pageWidth - margin - 21, bottomY + 13, { align: 'center' });

  const filename = `${buildFilename('registration-receipt', name)}.pdf`;
  doc.save(filename);
}

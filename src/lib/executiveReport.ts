import type { ApprovalRequest, DashboardAnalytics } from '@/lib/types';

export interface ExecutiveReportInput {
  period: string;
  analytics: DashboardAnalytics | null;
  requests: ApprovalRequest[];
}

function readable(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export function buildExecutiveReportCsv({ period, analytics, requests }: ExecutiveReportInput): string {
  const pending = requests.filter((item) => item.status === 'pending').length;
  const approved = requests.filter((item) => item.status === 'approved').length;
  const rows: unknown[][] = [
    ['Wisdom House Executive Report'],
    ['Reporting period', period],
    ['Prepared', new Date().toLocaleString('en-GB')],
    [],
    ['Overview', 'Value'],
    ['Total events', analytics?.totalEvents ?? 0],
    ['Upcoming events', analytics?.upcomingEvents ?? 0],
    ['Total registrations', analytics?.totalAttendees ?? 0],
    ['Governance requests', requests.length],
    ['Pending decisions', pending],
    ['Approved decisions', approved],
    [],
    ['Event category', 'Events'],
    ...Object.entries(analytics?.eventsByCategory ?? {}).map(([category, count]) => [readable(category), count]),
    [],
    ['Month', 'Events'],
    ...(analytics?.monthlyStats ?? []).map((row) => [row.month, row.count]),
    [],
    ['Reference', 'Request type', 'Status', 'Subject', 'Requested by', 'Created'],
    ...requests.map((request) => [
      request.ticketCode,
      readable(request.type),
      readable(request.status),
      request.entityLabel || 'Not provided',
      request.requestedByName || request.requestedByEmail || 'System',
      safeDate(request.createdAt),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export async function downloadExecutiveReportPdf({ period, analytics, requests }: ExecutiveReportInput): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = document.internal.pageSize.getWidth();
  const height = document.internal.pageSize.getHeight();
  const margin = 16;
  const pending = requests.filter((item) => item.status === 'pending').length;
  const approved = requests.filter((item) => item.status === 'approved').length;
  let y = 0;

  const addPageNumber = () => {
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    document.setTextColor(110, 110, 110);
    document.text(`Wisdom House · Confidential · Page ${document.getNumberOfPages()}`, width / 2, height - 8, { align: 'center' });
  };
  const newPage = () => {
    addPageNumber();
    document.addPage();
    y = 18;
  };
  const ensureSpace = (needed: number) => {
    if (y + needed > height - 18) newPage();
  };
  const heading = (title: string) => {
    ensureSpace(13);
    document.setFont('helvetica', 'bold');
    document.setFontSize(12);
    document.setTextColor(35, 35, 35);
    document.text(title, margin, y);
    document.setDrawColor(201, 157, 55);
    document.setLineWidth(0.7);
    document.line(margin, y + 3, margin + 24, y + 3);
    y += 10;
  };
  const tableRow = (values: string[], widths: number[], header = false) => {
    const lineHeight = 5;
    const wrapped = values.map((value, index) => document.splitTextToSize(value, widths[index] - 4) as string[]);
    const rowHeight = Math.max(9, Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + 3);
    ensureSpace(rowHeight);
    document.setFillColor(header ? 244 : 252, header ? 239 : 252, header ? 225 : 252);
    document.rect(margin, y, widths.reduce((total, item) => total + item, 0), rowHeight, 'F');
    document.setFont('helvetica', header ? 'bold' : 'normal');
    document.setFontSize(header ? 8.5 : 8);
    document.setTextColor(45, 45, 45);
    let x = margin;
    wrapped.forEach((lines, index) => {
      document.text(lines, x + 2, y + 5.5);
      x += widths[index];
    });
    document.setDrawColor(226, 226, 226);
    document.line(margin, y + rowHeight, margin + widths.reduce((total, item) => total + item, 0), y + rowHeight);
    y += rowHeight;
  };

  document.setFillColor(29, 24, 16);
  document.rect(0, 0, width, 51, 'F');
  document.setFillColor(201, 157, 55);
  document.rect(0, 0, width, 4, 'F');
  document.setFont('helvetica', 'bold');
  document.setTextColor(255, 255, 255);
  document.setFontSize(21);
  document.text('Executive Operations Report', margin, 22);
  document.setFont('helvetica', 'normal');
  document.setFontSize(10);
  document.setTextColor(220, 210, 188);
  document.text(`Wisdom House · ${period} · Prepared ${new Date().toLocaleString('en-GB')}`, margin, 31);
  document.text('A leadership-ready summary of ministry operations and governance activity.', margin, 39);
  y = 63;

  heading('Executive summary');
  const metrics = [
    ['Events', analytics?.totalEvents ?? 0],
    ['Registrations', analytics?.totalAttendees ?? 0],
    ['Pending decisions', pending],
    ['Approved decisions', approved],
  ] as const;
  const cardWidth = (width - margin * 2 - 9) / 4;
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + 3);
    document.setFillColor(248, 246, 241);
    document.roundedRect(x, y, cardWidth, 24, 2, 2, 'F');
    document.setFont('helvetica', 'bold');
    document.setFontSize(15);
    document.setTextColor(38, 38, 38);
    document.text(String(value), x + 4, y + 10);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.setTextColor(100, 100, 100);
    document.text(label, x + 4, y + 18);
  });
  y += 34;

  heading('Monthly performance');
  tableRow(['Month', 'Events'], [100, 74], true);
  if ((analytics?.monthlyStats.length ?? 0) === 0) tableRow(['No monthly performance data available.', ''], [100, 74]);
  analytics?.monthlyStats.forEach((row) => tableRow([row.month, String(row.count)], [100, 74]));
  y += 8;

  heading('Governance requests');
  tableRow(['Reference', 'Type', 'Status', 'Subject', 'Requested by', 'Created'], [27, 31, 22, 38, 35, 21], true);
  if (requests.length === 0) tableRow(['No requests', '', '', 'No governance requests were recorded.', '', ''], [27, 31, 22, 38, 35, 21]);
  requests.forEach((request) => tableRow([
    request.ticketCode,
    readable(request.type),
    readable(request.status),
    request.entityLabel || 'Not provided',
    request.requestedByName || request.requestedByEmail || 'System',
    safeDate(request.createdAt),
  ], [27, 31, 22, 38, 35, 21]));

  addPageNumber();
  document.save(`wisdom-house-executive-report-${period.toLowerCase()}.pdf`);
}

import {
  formatDeltaPct,
  formatNaira,
  formatPercent,
  type ChurchOverview,
} from '@/lib/analytics/churchOverview';

/* ============================================================================
   Executive report — the church-wide overview compiled into a leadership-ready
   PDF, a structured CSV, and a multi-sheet Excel workbook. All three read from
   one `ChurchOverview` (see churchOverview.ts).
============================================================================ */

function preparedLine(period: string): string {
  return `Wisdom House · ${period} · Prepared ${new Date().toLocaleString('en-GB')}`;
}

function escapeCsv(value: unknown): string {
  const raw = String(value ?? '');
  return /[",\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

/** Flat label/value pairs for the headline summary — reused by CSV + XLSX. */
function summaryRows(o: ChurchOverview): Array<[string, string | number]> {
  return [
    ['Members', o.people.members.total],
    ['Active members', o.people.members.active],
    ['Member activation', formatPercent(o.people.members.activationRate)],
    ['New members this month', o.people.newMembersInRange],
    ['Member growth vs last month', formatDeltaPct(o.people.memberGrowth.deltaPct)],
    ['Form submissions (all time)', o.intake.submissionsTotal],
    ['Form submissions (30 days)', o.intake.submissions.current],
    ['Submissions vs prior 30 days', formatDeltaPct(o.intake.submissions.deltaPct)],
    ['Giving this month', o.giving.hasData ? formatNaira(o.giving.thisMonthNaira) : 'No data'],
    ['Giving last month', o.giving.hasData ? formatNaira(o.giving.lastMonthNaira) : 'No data'],
    ['Giving year to date', o.giving.hasData ? formatNaira(o.giving.ytdNaira) : 'No data'],
    ['Workforce total', o.people.workforce.total],
    ['Workforce serving', o.people.workforce.serving],
    ['Volunteer coverage', formatPercent(o.people.workforce.coverageRate)],
    ['Attendance (30 days)', o.engagement.attendance.current],
    ['Newsletter subscribers', o.people.subscribers.total],
    ['Leadership profiles', o.people.leadership],
    ['Ministries', o.ministry.ministries],
    ['Cell groups', o.ministry.cellGroups],
    ['Decision readiness score', Math.round(o.signals.readinessScore)],
  ];
}

export function buildExecutiveReportCsv(o: ChurchOverview, period: string): string {
  const rows: unknown[][] = [
    ['Wisdom House Executive Report'],
    ['Reporting period', period],
    ['Prepared', new Date().toLocaleString('en-GB')],
    o.missing.length ? ['Note', `Partial report — missing: ${o.missing.join(', ')}`] : [],
    [],
    ['Summary', 'Value'],
    ...summaryRows(o),
    [],
    ['Needs attention', 'Count', 'Detail'],
    ...o.engagement.attention.map((a) => [a.label, a.count, a.hint]),
    [],
    ['Recommendation', 'Severity', 'Detail'],
    ...o.recommendations.map((r) => [r.title, r.severity, r.detail]),
    [],
    ['Form', 'Submissions'],
    ...o.intake.perForm.map((f) => [f.title, f.count]),
    [],
    ['Month', 'New members', 'New-member intake', 'Giving (₦)'],
    ...o.monthly.members.map((m, i) => [
      m.label,
      m.value,
      o.monthly.newMemberIntake[i]?.value ?? 0,
      o.monthly.giving[i]?.value ?? 0,
    ]),
  ];
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

export async function downloadExecutiveReportXlsx(
  o: ChurchOverview,
  period: string
): Promise<void> {
  const mod = (await import('exceljs')) as unknown as {
    default?: typeof import('exceljs');
  } & typeof import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'The Wisdom Church';
  wb.created = new Date();

  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 34 }, { width: 26 }];
  summary.addRow(['Wisdom House Executive Report']).getCell(1).font = { bold: true, size: 14 };
  summary.addRow([preparedLine(period)]);
  if (o.missing.length) summary.addRow([`Partial — missing: ${o.missing.join(', ')}`]);
  summary.addRow([]);
  summary.addRow(['Metric', 'Value']).font = { bold: true };
  summaryRows(o).forEach(([k, v]) => {
    const row = summary.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  });

  const attention = wb.addWorksheet('Needs attention');
  attention.columns = [{ width: 32 }, { width: 10 }, { width: 12 }, { width: 60 }];
  attention.addRow(['Queue', 'Count', 'Severity', 'Detail']).font = { bold: true };
  o.engagement.attention.forEach((a) => attention.addRow([a.label, a.count, a.severity, a.hint]));
  attention.addRow([]);
  attention.addRow(['Recommendation', '', 'Severity', 'Detail']).font = { bold: true };
  o.recommendations.forEach((r) => attention.addRow([r.title, '', r.severity, r.detail]));

  const forms = wb.addWorksheet('Forms');
  forms.columns = [{ width: 44 }, { width: 16 }];
  forms.addRow(['Form', 'Submissions']).font = { bold: true };
  o.intake.perForm.forEach((f) => forms.addRow([f.title, f.count]));

  const growth = wb.addWorksheet('Growth');
  growth.columns = [{ width: 12 }, { width: 16 }, { width: 20 }, { width: 18 }];
  growth.addRow(['Month', 'New members', 'New-member intake', 'Giving (₦)']).font = { bold: true };
  o.monthly.members.forEach((m, i) => {
    growth.addRow([
      m.label,
      m.value,
      o.monthly.newMemberIntake[i]?.value ?? 0,
      o.monthly.giving[i]?.value ?? 0,
    ]);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `wisdom-house-executive-report-${slugPeriod(period)}.xlsx`);
}

export async function downloadExecutiveReportPdf(
  o: ChurchOverview,
  period: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = 0;

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `Wisdom House · Confidential · Page ${doc.getNumberOfPages()}`,
      width / 2,
      height - 8,
      { align: 'center' }
    );
  };
  const newPage = () => {
    footer();
    doc.addPage();
    y = 18;
  };
  const ensure = (needed: number) => {
    if (y + needed > height - 18) newPage();
  };
  const heading = (title: string) => {
    ensure(13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(35, 35, 35);
    doc.text(title, margin, y);
    doc.setDrawColor(201, 157, 55);
    doc.setLineWidth(0.7);
    doc.line(margin, y + 3, margin + 24, y + 3);
    y += 10;
  };
  const row = (a: string, b: string, bold = false) => {
    ensure(7);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(a, margin, y);
    doc.text(b, width - margin, y, { align: 'right' });
    y += 6;
  };
  const para = (text: string) => {
    const lines = doc.splitTextToSize(text, width - margin * 2) as string[];
    ensure(lines.length * 4.6 + 2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(70, 70, 70);
    doc.text(lines, margin, y);
    y += lines.length * 4.6 + 3;
  };

  // Header band
  doc.setFillColor(29, 24, 16);
  doc.rect(0, 0, width, 51, 'F');
  doc.setFillColor(201, 157, 55);
  doc.rect(0, 0, width, 4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(21);
  doc.text('Church Health Report', margin, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 210, 188);
  doc.text(preparedLine(period), margin, 31);
  doc.text('Growth, giving, engagement and decision readiness across the church.', margin, 39);
  y = 63;

  heading('At a glance');
  const kpis: Array<[string, string]> = [
    ['Members', `${o.people.members.total.toLocaleString()}  (${formatPercent(o.people.members.activationRate)} active)`],
    ['New members this month', `${o.people.newMembersInRange}  (${formatDeltaPct(o.people.memberGrowth.deltaPct)} vs last month)`],
    ['Form submissions (30d)', `${o.intake.submissions.current}  (${formatDeltaPct(o.intake.submissions.deltaPct)})`],
    ['Giving this month', o.giving.hasData ? `${formatNaira(o.giving.thisMonthNaira)}  (${formatDeltaPct(o.giving.trend.deltaPct)})` : 'No recorded giving'],
    ['Volunteer coverage', formatPercent(o.people.workforce.coverageRate)],
    ['Attendance (30d)', o.engagement.attendance.current.toLocaleString()],
    ['Decision readiness', `${Math.round(o.signals.readinessScore)} / 100`],
  ];
  kpis.forEach(([k, v]) => row(k, v));
  y += 4;

  heading('Needs attention');
  if (o.engagement.attention.filter((a) => a.count > 0).length === 0) {
    para('Every queue is clear.');
  } else {
    o.engagement.attention
      .filter((a) => a.count > 0)
      .forEach((a) => row(a.label, String(a.count), a.severity !== 'info'));
  }
  y += 4;

  heading('Recommendations');
  o.recommendations.forEach((r) => {
    ensure(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(r.severity === 'warn' ? 180 : 45, r.severity === 'warn' ? 83 : 45, r.severity === 'warn' ? 9 : 45);
    doc.text(`• ${r.title}`, margin, y);
    y += 4.6;
    para(r.detail);
  });
  y += 2;

  heading('Form intake');
  row('Form', 'Submissions', true);
  if (o.intake.perForm.length === 0) para('No form submissions yet.');
  o.intake.perForm.forEach((f) => row(f.title, String(f.count)));
  y += 4;

  heading('12-month trend');
  row('Month', 'Members · Intake · Giving (₦)', true);
  o.monthly.members.forEach((m, i) =>
    row(
      m.label,
      `${m.value} · ${o.monthly.newMemberIntake[i]?.value ?? 0} · ${(o.monthly.giving[i]?.value ?? 0).toLocaleString()}`
    )
  );

  footer();
  doc.save(`wisdom-house-executive-report-${slugPeriod(period)}.pdf`);
}

function slugPeriod(period: string): string {
  return period.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
